import { z } from 'zod';

export const RankTierSchema = z.enum([
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'MASTER',
]);
export type RankTier = z.infer<typeof RankTierSchema>;

export const RANK_TIERS: Array<{ tier: RankTier; min: number; label: string }> = [
  { tier: 'BRONZE', min: 0, label: 'Bronce' },
  { tier: 'SILVER', min: 1100, label: 'Plata' },
  { tier: 'GOLD', min: 1300, label: 'Oro' },
  { tier: 'PLATINUM', min: 1500, label: 'Platino' },
  { tier: 'DIAMOND', min: 1800, label: 'Diamante' },
  { tier: 'MASTER', min: 2200, label: 'Master' },
];

export function tierForElo(elo: number): { tier: RankTier; label: string } {
  let current = RANK_TIERS[0]!;
  for (const t of RANK_TIERS) if (elo >= t.min) current = t;
  return { tier: current.tier, label: current.label };
}

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  level: z.number(),
  elo: z.number(),
  wins: z.number(),
  losses: z.number(),
  tier: RankTierSchema,
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  seasonId: z.string(),
  seasonName: z.string(),
  top: z.array(LeaderboardEntrySchema),
  me: LeaderboardEntrySchema.nullable(),
  totalPlayers: z.number(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
