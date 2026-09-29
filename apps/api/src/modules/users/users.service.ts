import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Prisma } from '@carnia/db';
import {
  GAME,
  levelForXp,
  totalXpForLevel,
  xpForLevel,
  type AuthTokens,
  type MatchSummary,
  type PublicProfile,
  type UserStats,
} from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

const matchWithPlayers = {
  participants: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
} satisfies Prisma.MatchInclude;
type MatchWithPlayers = Prisma.MatchGetPayload<{ include: typeof matchWithPlayers }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  async getStats(userId: string): Promise<UserStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { rankedStats: true },
    });
    if (!user) throw new NotFoundException();

    const [matchesPlayed, accuracy] = await Promise.all([
      this.countFinishedMatches(userId),
      this.accuracyOf(userId),
    ]);
    const xpInCurrentLevel = user.xp - totalXpForLevel(user.level);
    const xpToNextLevel = xpForLevel(user.level);

    return {
      xp: user.xp,
      level: user.level,
      xpInCurrentLevel,
      xpToNextLevel,
      progress: xpInCurrentLevel / xpToNextLevel,
      matchesPlayed,
      accuracy,
      elo: user.rankedStats?.elo ?? GAME.DEFAULT_ELO,
      wins: user.rankedStats?.wins ?? 0,
      losses: user.rankedStats?.losses ?? 0,
      winStreak: user.rankedStats?.winStreak ?? 0,
    };
  }

  async getHistory(userId: string): Promise<MatchSummary[]> {
    const matches = await this.recentMatches(userId, 30);
    return matches.map((m) => toMatchSummary(m, userId));
  }

  async getPublicProfile(username: string): Promise<PublicProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { rankedStats: true, achievements: { orderBy: { earnedAt: 'asc' } } },
    });
    if (!user) return null;

    const [matchesPlayed, accuracy, recent] = await Promise.all([
      this.countFinishedMatches(user.id),
      this.accuracyOf(user.id),
      this.recentMatches(user.id, 5),
    ]);

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      level: user.level,
      xp: user.xp,
      elo: user.rankedStats?.elo ?? GAME.DEFAULT_ELO,
      peakElo: user.rankedStats?.peakElo ?? GAME.DEFAULT_ELO,
      wins: user.rankedStats?.wins ?? 0,
      losses: user.rankedStats?.losses ?? 0,
      winStreak: user.rankedStats?.winStreak ?? 0,
      matchesPlayed,
      accuracy,
      achievements: user.achievements.map((a) => ({
        achievementId: a.achievementId,
        earnedAt: a.earnedAt.toISOString(),
      })),
      recentMatches: recent.map((m) => toMatchSummary(m, user.id)),
    };
  }

  async updateUsername(userId: string, username: string): Promise<{ id: string; username: string }> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { username },
        select: { id: true, username: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'username_taken', message: 'El nombre de usuario ya está en uso' });
      }
      throw err;
    }
  }

  /** Cambia la contraseña, cierra el resto de sesiones y devuelve tokens nuevos. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException({ code: 'wrong_password', message: 'La contraseña actual es incorrecta' });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.auth.revokeAllSessions(userId);
    return this.auth.issueTokens(user);
  }

  /**
   * Borra la cuenta. Si el usuario ha jugado contra otros, su fila se anonimiza
   * para no romper el historial del rival; si no, se elimina por completo.
   */
  async deleteAccount(userId: string): Promise<void> {
    const pvpMatches = await this.prisma.matchParticipant.count({
      where: { userId, match: { mode: { not: 'SOLO' } } },
    });

    await this.prisma.$transaction([
      this.prisma.match.deleteMany({ where: { player1Id: userId, mode: 'SOLO' } }),
      this.prisma.userAchievement.deleteMany({ where: { userId } }),
      this.prisma.dailyEntry.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.rankedStats.deleteMany({ where: { userId } }),
      pvpMatches === 0
        ? this.prisma.user.delete({ where: { id: userId } })
        : this.prisma.user.update({
            where: { id: userId },
            data: {
              email: `deleted-${userId}@deleted.invalid`,
              username: `borrado_${userId.slice(-8)}`,
              passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
              avatarUrl: null,
            },
          }),
    ]);
    await this.leaderboard.removeUser(userId).catch(() => undefined);
  }

  /**
   * Incrementa XP y sincroniza el nivel en una transacción, para que dos partidas
   * que terminan a la vez no sobrescriban el nivel con un valor antiguo.
   */
  async addXp(userId: string, delta: number): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: delta } },
        select: { xp: true, level: true },
      });
      const newLevel = levelForXp(updated.xp);
      if (newLevel !== updated.level) {
        await tx.user.update({ where: { id: userId }, data: { level: newLevel } });
      }
      return { newXp: updated.xp, newLevel, leveledUp: newLevel > updated.level };
    });
  }

  private countFinishedMatches(userId: string): Promise<number> {
    return this.prisma.matchParticipant.count({ where: { userId, match: { status: 'FINISHED' } } });
  }

  private async accuracyOf(userId: string): Promise<number> {
    const [answered, correct] = await Promise.all([
      this.prisma.matchAnswer.count({ where: { userId } }),
      this.prisma.matchAnswer.count({ where: { userId, isCorrect: true } }),
    ]);
    return answered > 0 ? correct / answered : 0;
  }

  private recentMatches(userId: string, take: number): Promise<MatchWithPlayers[]> {
    return this.prisma.match.findMany({
      where: { participants: { some: { userId } }, status: 'FINISHED' },
      orderBy: { startedAt: 'desc' },
      take,
      include: matchWithPlayers,
    });
  }
}

function toMatchSummary(m: MatchWithPlayers, userId: string): MatchSummary {
  const me = m.participants.find((p) => p.userId === userId);
  const opp = m.participants.find((p) => p.userId !== userId);
  return {
    id: m.id,
    mode: m.mode,
    winnerId: m.winnerId,
    score: me?.score ?? 0,
    correctCount: me?.correctCount ?? 0,
    questionCount: m.questionCount,
    xpEarned: me?.xpEarned ?? 0,
    opponent: opp ? { id: opp.user.id, username: opp.user.username, avatarUrl: opp.user.avatarUrl } : null,
    startedAt: m.startedAt.toISOString(),
    endedAt: m.endedAt?.toISOString() ?? null,
  };
}
