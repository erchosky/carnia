import { Injectable, Logger } from '@nestjs/common';
import { tierForElo, type LeaderboardEntry, type LeaderboardResponse } from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * Leaderboard híbrido:
 * - Redis sorted set `lb:season:{id}` (score = elo, member = userId) → fuente de lectura
 * - Postgres `RankedStats` → fuente de escritura cuando hay match. Se sincroniza
 *   a Redis on-write.
 * - Si Redis no está disponible, cae a Postgres.
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger('Leaderboard');
  private warmed = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Lee top N + el rank del usuario actual. */
  async getLeaderboard(opts: {
    seasonId?: string;
    userId?: string;
    limit?: number;
  }): Promise<LeaderboardResponse> {
    const season = await this.resolveSeason(opts.seasonId);
    if (!season) {
      return { seasonId: '', seasonName: 'Sin temporada activa', top: [], me: null, totalPlayers: 0 };
    }
    const limit = opts.limit ?? 50;

    await this.warmIfNeeded(season.id);

    const redis = this.redis.optional();
    const key = lbKey(season.id);

    let topPairs: Array<{ userId: string; elo: number }> = [];
    let totalPlayers = 0;
    let myEntry: { userId: string; elo: number; rank: number } | null = null;

    if (redis) {
      // ZREVRANGE WITHSCORES — top N orderado desc por ELO
      const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
      for (let i = 0; i < raw.length; i += 2) {
        topPairs.push({ userId: raw[i]!, elo: Number(raw[i + 1]!) });
      }
      totalPlayers = await redis.zcard(key);

      if (opts.userId) {
        const myScore = await redis.zscore(key, opts.userId);
        if (myScore !== null) {
          const rank = await redis.zrevrank(key, opts.userId);
          myEntry = {
            userId: opts.userId,
            elo: Number(myScore),
            rank: (rank ?? 0) + 1,
          };
        }
      }
    } else {
      // Fallback Postgres
      const rows = await this.prisma.rankedStats.findMany({
        where: { seasonId: season.id },
        orderBy: { elo: 'desc' },
        take: limit,
      });
      topPairs = rows.map((r) => ({ userId: r.userId, elo: r.elo }));
      totalPlayers = await this.prisma.rankedStats.count({ where: { seasonId: season.id } });
    }

    const userIds = new Set<string>(topPairs.map((p) => p.userId));
    if (myEntry) userIds.add(myEntry.userId);

    if (userIds.size === 0) {
      return {
        seasonId: season.id,
        seasonName: season.name,
        top: [],
        me: null,
        totalPlayers,
      };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      include: { rankedStats: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const top: LeaderboardEntry[] = topPairs.map((p, idx) => {
      const u = userMap.get(p.userId);
      return toEntry({
        rank: idx + 1,
        userId: p.userId,
        username: u?.username ?? 'Anónimo',
        avatarUrl: u?.avatarUrl ?? null,
        level: u?.level ?? 1,
        elo: p.elo,
        wins: u?.rankedStats?.wins ?? 0,
        losses: u?.rankedStats?.losses ?? 0,
      });
    });

    let me: LeaderboardEntry | null = null;
    if (myEntry) {
      const u = userMap.get(myEntry.userId);
      me = toEntry({
        rank: myEntry.rank,
        userId: myEntry.userId,
        username: u?.username ?? 'Yo',
        avatarUrl: u?.avatarUrl ?? null,
        level: u?.level ?? 1,
        elo: myEntry.elo,
        wins: u?.rankedStats?.wins ?? 0,
        losses: u?.rankedStats?.losses ?? 0,
      });
    } else if (opts.userId) {
      // Si no aparezco en Redis (sin partidas ranked), busco en Postgres
      const stats = await this.prisma.rankedStats.findUnique({
        where: { userId: opts.userId },
        include: { user: true },
      });
      if (stats) {
        // Calcula rank aproximado
        const better = await this.prisma.rankedStats.count({
          where: { seasonId: season.id, elo: { gt: stats.elo } },
        });
        me = toEntry({
          rank: better + 1,
          userId: stats.userId,
          username: stats.user.username,
          avatarUrl: stats.user.avatarUrl,
          level: stats.user.level,
          elo: stats.elo,
          wins: stats.wins,
          losses: stats.losses,
        });
      }
    }

    return { seasonId: season.id, seasonName: season.name, top, me, totalPlayers };
  }

  /** Quita al usuario de todos los rankings de Redis (p. ej. al borrar la cuenta). */
  async removeUser(userId: string): Promise<void> {
    const redis = this.redis.optional();
    if (!redis) return;
    const seasons = await this.prisma.season.findMany({ select: { id: true } });
    await Promise.all(seasons.map((s) => redis.zrem(lbKey(s.id), userId)));
  }

  /** Actualiza el ELO de un usuario en Redis tras una partida ranked. */
  async upsertScore(seasonId: string, userId: string, elo: number): Promise<void> {
    const redis = this.redis.optional();
    if (!redis) return;
    await redis.zadd(lbKey(seasonId), elo, userId);
  }

  // ─── Internals ───

  private async resolveSeason(
    seasonId?: string,
  ): Promise<{ id: string; name: string } | null> {
    if (seasonId) {
      const s = await this.prisma.season.findUnique({ where: { id: seasonId } });
      if (s) return { id: s.id, name: s.name };
    }
    const active = await this.prisma.season.findFirst({
      where: { active: true },
      orderBy: { startsAt: 'desc' },
    });
    return active ? { id: active.id, name: active.name } : null;
  }

  /** Carga RankedStats → Redis si no se ha hecho en este proceso. */
  private async warmIfNeeded(seasonId: string): Promise<void> {
    if (this.warmed.has(seasonId)) return;
    const redis = this.redis.optional();
    if (!redis) return;

    const key = lbKey(seasonId);
    const size = await redis.zcard(key);
    if (size > 0) {
      this.warmed.add(seasonId);
      return;
    }

    const rows = await this.prisma.rankedStats.findMany({
      where: { seasonId },
      select: { userId: true, elo: true },
    });
    if (rows.length > 0) {
      const args: (string | number)[] = [];
      for (const r of rows) {
        args.push(r.elo, r.userId);
      }
      await redis.zadd(key, ...(args as [number, string]));
      this.logger.log(`Warmed leaderboard ${seasonId} (${rows.length} entries)`);
    }
    this.warmed.add(seasonId);
  }
}

function toEntry(e: {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  elo: number;
  wins: number;
  losses: number;
}): LeaderboardEntry {
  return {
    rank: e.rank,
    userId: e.userId,
    username: e.username,
    avatarUrl: e.avatarUrl,
    level: e.level,
    elo: e.elo,
    wins: e.wins,
    losses: e.losses,
    tier: tierForElo(e.elo).tier,
  };
}

function lbKey(seasonId: string): string {
  return `lb:season:${seasonId}`;
}
