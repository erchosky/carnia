import { Injectable, Logger } from '@nestjs/common';
import { GAME, matchXp, type MatchEndPayload } from '@carnia/contracts';
import type { Prisma } from '@carnia/db';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { AntiCheatService } from '../../anti-cheat/anti-cheat.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { compute1v1 } from '../../game/progression/elo-calculator';
import { answersOf, type MatchOutcome, type MatchState } from '../../game/engine/match-state';

export type MatchResults = Pick<MatchEndPayload, 'correctCounts' | 'xpEarned' | 'eloDelta' | 'newElo'>;

interface PlayerSummary {
  userId: string;
  correct: number;
  avgAnswerMs: number;
  fastAnswers: number;
  xp: number;
  isWinner: boolean;
}

interface EloChange {
  delta: Record<string, number>;
  newElo: Record<string, number>;
}

/**
 * Persiste el resultado de un match PvP terminado: Match, participantes, ELO,
 * leaderboard, XP y logros. Separado del orquestador para que el flujo en tiempo
 * real no mezcle la lógica de persistencia.
 */
@Injectable()
export class MatchFinalizerService {
  private readonly logger = new Logger('MatchFinalizer');

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly leaderboard: LeaderboardService,
    private readonly antiCheat: AntiCheatService,
    private readonly achievements: AchievementsService,
  ) {}

  async finalize(state: MatchState, outcome: MatchOutcome): Promise<MatchResults> {
    const summaries = state.players.map((p) => summarize(state, p.userId, outcome));
    const activeSeason = await this.prisma.season.findFirst({
      where: { active: true },
      orderBy: { startsAt: 'desc' },
      select: { id: true },
    });
    const seasonId = activeSeason?.id ?? null;
    const elo = await this.computeElo(state, outcome);

    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: state.matchId },
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          winnerId: outcome.winnerId,
          seasonId,
          durationMs: state.finishedAt ? state.finishedAt - state.startedAt : null,
        },
      }),
      ...summaries.map((s) =>
        this.prisma.matchParticipant.update({
          where: { matchId_userId: { matchId: state.matchId, userId: s.userId } },
          data: {
            score: state.scores[s.userId] ?? 0,
            correctCount: s.correct,
            avgAnswerMs: s.avgAnswerMs,
            xpEarned: s.xp,
            eloDelta: elo?.delta[s.userId] ?? 0,
          },
        }),
      ),
      this.prisma.room.update({
        where: { id: state.roomId },
        data: { status: 'FINISHED', closedAt: new Date() },
      }),
      ...(elo ? this.rankedStatsUpserts(state, outcome, elo, seasonId) : []),
    ]);

    if (elo) await this.syncRanking(state, seasonId);

    for (const s of summaries) {
      await this.users.addXp(s.userId, s.xp);
    }

    // Logros y anti-cheat no deben bloquear ni romper el final de la partida.
    for (const s of summaries) {
      void this.achievements.checkAndAward(s.userId, {
        matchId: state.matchId,
        isWin: s.isWinner,
        correctCount: s.correct,
        totalRounds: state.totalRounds,
        fastAnswers: s.fastAnswers,
      });
    }
    try {
      this.antiCheat.analyze(state);
    } catch (err) {
      this.logger.warn(`anti-cheat analyze failed: ${(err as Error).message}`);
    }

    return {
      correctCounts: Object.fromEntries(summaries.map((s) => [s.userId, s.correct])),
      xpEarned: Object.fromEntries(summaries.map((s) => [s.userId, s.xp])),
      eloDelta: elo?.delta ?? {},
      newElo: elo?.newElo ?? {},
    };
  }

  /** Resultados sin persistir, para informar a los clientes si la persistencia falla. */
  summarizeOnly(state: MatchState, outcome: MatchOutcome): MatchResults {
    const summaries = state.players.map((p) => summarize(state, p.userId, outcome));
    return {
      correctCounts: Object.fromEntries(summaries.map((s) => [s.userId, s.correct])),
      xpEarned: Object.fromEntries(summaries.map((s) => [s.userId, 0])),
      eloDelta: {},
      newElo: {},
    };
  }

  private async computeElo(state: MatchState, outcome: MatchOutcome): Promise<EloChange | null> {
    const [pA, pB] = state.players;
    if (!pA || !pB || state.players.length !== 2) return null;

    const [statsA, statsB] = await Promise.all([
      this.prisma.rankedStats.findUnique({ where: { userId: pA.userId } }),
      this.prisma.rankedStats.findUnique({ where: { userId: pB.userId } }),
    ]);
    const games = (s: typeof statsA) => (s ? s.wins + s.losses + s.draws : 0);

    const { a, b } = compute1v1({
      playerA: { elo: statsA?.elo ?? GAME.DEFAULT_ELO, gamesPlayed: games(statsA) },
      playerB: { elo: statsB?.elo ?? GAME.DEFAULT_ELO, gamesPlayed: games(statsB) },
      result: outcome.draw ? 'draw' : outcome.winnerId === pA.userId ? 'A' : 'B',
    });
    return {
      delta: { [pA.userId]: a.delta, [pB.userId]: b.delta },
      newElo: { [pA.userId]: a.newElo, [pB.userId]: b.newElo },
    };
  }

  private rankedStatsUpserts(
    state: MatchState,
    outcome: MatchOutcome,
    elo: EloChange,
    seasonId: string | null,
  ): Prisma.PrismaPromise<unknown>[] {
    return state.players.map((p) => {
      const isWinner = outcome.winnerId === p.userId;
      const isLoss = !isWinner && !outcome.draw;
      const newElo = elo.newElo[p.userId] ?? GAME.DEFAULT_ELO;
      return this.prisma.rankedStats.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          elo: newElo,
          peakElo: Math.max(GAME.DEFAULT_ELO, newElo),
          wins: isWinner ? 1 : 0,
          losses: isLoss ? 1 : 0,
          draws: outcome.draw ? 1 : 0,
          winStreak: isWinner ? 1 : 0,
          bestStreak: isWinner ? 1 : 0,
          seasonId,
        },
        update: {
          elo: { increment: elo.delta[p.userId] ?? 0 },
          wins: isWinner ? { increment: 1 } : undefined,
          losses: isLoss ? { increment: 1 } : undefined,
          draws: outcome.draw ? { increment: 1 } : undefined,
          winStreak: isWinner ? { increment: 1 } : { set: 0 },
          ...(seasonId ? { seasonId } : {}),
        },
      });
    });
  }

  /** peakElo/bestStreak con GREATEST() (atómico) y sincronización del leaderboard Redis. */
  private async syncRanking(state: MatchState, seasonId: string | null): Promise<void> {
    const userIds = state.players.map((p) => p.userId);
    await this.prisma.$executeRaw`
      UPDATE "RankedStats"
      SET "peakElo" = GREATEST("peakElo", "elo"),
          "bestStreak" = GREATEST("bestStreak", "winStreak")
      WHERE "userId" = ANY(${userIds}::text[])
    `;
    if (!seasonId) return;

    const fresh = await this.prisma.rankedStats.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, elo: true },
    });
    for (const f of fresh) {
      await this.leaderboard.upsertScore(seasonId, f.userId, f.elo).catch((err) =>
        this.logger.warn(`leaderboard upsert failed user=${f.userId}: ${(err as Error).message}`),
      );
    }
  }
}

function summarize(state: MatchState, userId: string, outcome: MatchOutcome): PlayerSummary {
  const answered = answersOf(state, userId);
  const correct = answered.filter((a) => a.isCorrect).length;
  const withOption = answered.filter((a) => a.optionId !== null);
  const isWinner = outcome.winnerId === userId;
  return {
    userId,
    correct,
    avgAnswerMs: withOption.length
      ? Math.round(withOption.reduce((s, a) => s + a.answerMs, 0) / withOption.length)
      : 0,
    fastAnswers: withOption.filter((a) => a.answerMs < GAME.FAST_ANSWER_MS).length,
    xp: matchXp({ correctCount: correct, totalRounds: state.totalRounds, isWinner }),
    isWinner,
  };
}
