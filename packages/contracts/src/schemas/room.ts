import { z } from 'zod';
import { MatchModeSchema } from './match.js';
import { QuestionCategorySchema } from './question.js';

export const RoomMemberSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  level: z.number(),
  ready: z.boolean(),
  connected: z.boolean(),
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;

export const RoomStateSchema = z.object({
  id: z.string(),
  code: z.string(),
  mode: MatchModeSchema,
  status: z.enum(['LOBBY', 'STARTING', 'IN_MATCH', 'FINISHED', 'ABANDONED']),
  hostId: z.string(),
  maxPlayers: z.number(),
  members: z.array(RoomMemberSchema),
  createdAt: z.string(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;

export const GAME_MODE_OPTIONS = ['PVP_1V1', 'SURVIVAL', 'BLITZ'] as const;
export type GameModeOption = (typeof GAME_MODE_OPTIONS)[number];

export const RoomConfigSchema = z.object({
  questionDurationMs: z.union([
    z.literal(5000),
    z.literal(10000),
    z.literal(15000),
    z.literal(30000),
  ]),
  totalRounds: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
  ]),
  /** null o vacío = todas las categorías */
  categories: z.array(QuestionCategorySchema).max(QuestionCategorySchema.options.length).nullable(),
  gameMode: z.enum(GAME_MODE_OPTIONS),
});
export type RoomConfig = z.infer<typeof RoomConfigSchema>;

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  questionDurationMs: 15000,
  totalRounds: 10,
  categories: null,
  gameMode: 'PVP_1V1',
};
