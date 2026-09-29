import { z } from 'zod';

export const MatchModeSchema = z.enum(['PVP_1V1', 'SOLO', 'RANKED', 'CUSTOM']);
export type MatchMode = z.infer<typeof MatchModeSchema>;
