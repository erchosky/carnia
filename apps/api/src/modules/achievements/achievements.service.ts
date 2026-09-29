import { Injectable, Logger } from '@nestjs/common';
import {
  ACHIEVEMENTS,
  type AchievementId,
  type AchievementStatus,
} from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface AchievementCheckContext {
  matchId?: string;
  isWin?: boolean;
  correctCount?: number;
  totalRounds?: number;
  /** Respuestas por debajo de GAME.FAST_ANSWER_MS en este match. */
  fastAnswers?: number;
  dailyStreak?: number;
  isSoloMode?: boolean;
  isTrapMode?: boolean;
}

interface UserProgress {
  winStreak: number;
  elo: number;
  matchesPlayed: number;
}

const PERFECT_MIN_ROUNDS = 10;

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger('AchievementsService');

  constructor(private readonly prisma: PrismaService) {}

  async getAllWithStatus(userId: string): Promise<AchievementStatus[]> {
    const earned = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, earnedAt: true },
    });
    const earnedAt = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));
    return Object.values(ACHIEVEMENTS).map((a) => ({
      ...a,
      earned: earnedAt.has(a.id),
      earnedAt: earnedAt.get(a.id)?.toISOString() ?? null,
    }));
  }

  /**
   * Concede los logros que el contexto permita. Nunca lanza: los logros no deben
   * romper el flujo que los dispara. Devuelve los IDs concedidos.
   */
  async checkAndAward(userId: string, ctx: AchievementCheckContext): Promise<AchievementId[]> {
    try {
      const candidates = candidateIds(ctx);
      if (candidates.length === 0) return [];

      const already = await this.prisma.userAchievement.findMany({
        where: { userId, achievementId: { in: candidates } },
        select: { achievementId: true },
      });
      const alreadySet = new Set(already.map((a) => a.achievementId));
      const pending = candidates.filter((id) => !alreadySet.has(id));
      if (pending.length === 0) return [];

      const progress = await this.loadProgress(userId, ctx);
      const awarded = pending.filter((id) => qualifies(id, ctx, progress));
      if (awarded.length > 0) {
        await this.prisma.userAchievement.createMany({
          data: awarded.map((achievementId) => ({ userId, achievementId })),
          skipDuplicates: true,
        });
        this.logger.log(`Awarded achievements to userId=${userId}: ${awarded.join(', ')}`);
      }
      return awarded;
    } catch (err) {
      this.logger.warn(`checkAndAward failed for userId=${userId}: ${(err as Error).message}`);
      return [];
    }
  }

  private async loadProgress(userId: string, ctx: AchievementCheckContext): Promise<UserProgress> {
    if (!ctx.matchId) return { winStreak: 0, elo: 0, matchesPlayed: 0 };
    const [stats, matchesPlayed] = await Promise.all([
      this.prisma.rankedStats.findUnique({ where: { userId }, select: { winStreak: true, elo: true } }),
      this.prisma.matchParticipant.count({ where: { userId, match: { status: 'FINISHED' } } }),
    ]);
    return { winStreak: stats?.winStreak ?? 0, elo: stats?.elo ?? 0, matchesPlayed };
  }
}

function candidateIds(ctx: AchievementCheckContext): AchievementId[] {
  const ids: AchievementId[] = [];
  if (ctx.isWin) ids.push('first_win', 'win_streak_3', 'win_streak_5');
  if (ctx.correctCount !== undefined && ctx.totalRounds !== undefined) {
    ids.push(ctx.isSoloMode ? 'perfect_solo' : 'perfect_match');
    if (ctx.isTrapMode) ids.push('trap_master');
  }
  if (ctx.fastAnswers !== undefined) ids.push('speed_demon');
  if (ctx.dailyStreak !== undefined) ids.push('daily_7', 'daily_30');
  // Al terminar cualquier match se revisan los logros de progreso.
  if (ctx.matchId) ids.push('matches_10', 'matches_50', 'elo_1200', 'elo_1500');
  return ids;
}

function qualifies(id: AchievementId, ctx: AchievementCheckContext, p: UserProgress): boolean {
  const perfect =
    ctx.correctCount !== undefined &&
    ctx.totalRounds !== undefined &&
    ctx.totalRounds >= PERFECT_MIN_ROUNDS &&
    ctx.correctCount === ctx.totalRounds;

  switch (id) {
    case 'first_win':
      return ctx.isWin === true;
    case 'win_streak_3':
      return p.winStreak >= 3;
    case 'win_streak_5':
      return p.winStreak >= 5;
    case 'perfect_match':
      return perfect && !ctx.isSoloMode;
    case 'perfect_solo':
      return perfect && ctx.isSoloMode === true;
    case 'trap_master':
      return ctx.isTrapMode === true && (ctx.correctCount ?? 0) >= 8;
    case 'speed_demon':
      return (ctx.fastAnswers ?? 0) >= 5;
    case 'daily_7':
      return (ctx.dailyStreak ?? 0) >= 7;
    case 'daily_30':
      return (ctx.dailyStreak ?? 0) >= 30;
    case 'elo_1200':
      return p.elo >= 1200;
    case 'elo_1500':
      return p.elo >= 1500;
    case 'matches_10':
      return p.matchesPlayed >= 10;
    case 'matches_50':
      return p.matchesPlayed >= 50;
  }
}
