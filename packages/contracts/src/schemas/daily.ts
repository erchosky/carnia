import { z } from 'zod';
import type { QuestionPublic } from './question.js';

export const DailyDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

export const DailySubmitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1), optionId: z.string().min(1) }))
    .max(50),
});
export type DailySubmitInput = z.infer<typeof DailySubmitSchema>;

export interface DailyChallenge {
  date: string;
  questions: QuestionPublic[];
}

export interface DailyEntrySummary {
  score: number;
  correctCount: number;
  completedAt: string;
}

export interface DailyStatus {
  completed: boolean;
  entry: DailyEntrySummary | null;
  streak: number;
}

export interface DailySubmitResult {
  score: number;
  correctCount: number;
  total: number;
  streak: number;
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    correctOptionId: string;
    yourOptionId: string | null;
  }>;
}

export interface DailyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  score: number;
  correctCount: number;
  completedAt: string;
}
