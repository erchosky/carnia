import { z } from 'zod';
import { QuestionCategorySchema, QuestionPublicSchema } from './question.js';

export const SoloStartSchema = z.object({
  category: z.union([z.literal('MIXED'), QuestionCategorySchema]).default('MIXED'),
  /** Modo Trampa: solo preguntas con respuestas engañosas */
  trapOnly: z.boolean().default(false),
});
export type SoloStartInput = z.infer<typeof SoloStartSchema>;

export const SoloRoundSchema = z.object({
  question: QuestionPublicSchema,
  roundIndex: z.number(),
  serverStartedAt: z.number(),
  durationMs: z.number(),
});
export type SoloRound = z.infer<typeof SoloRoundSchema>;

export const SoloStartResponseSchema = SoloRoundSchema.extend({
  sessionId: z.string(),
  totalQuestions: z.number(),
});
export type SoloStartResponse = z.infer<typeof SoloStartResponseSchema>;

export const SoloNextSchema = z.object({ sessionId: z.string() });
export type SoloNextInput = z.infer<typeof SoloNextSchema>;

export const SoloAnswerSchema = z.object({
  sessionId: z.string(),
  roundIndex: z.number().int().min(0),
  optionId: z.string().nullable(),
});
export type SoloAnswerInput = z.infer<typeof SoloAnswerSchema>;

export const SoloAnswerResponseSchema = z.object({
  roundIndex: z.number(),
  isCorrect: z.boolean(),
  correctOptionId: z.string(),
  explanation: z.string(),
  scoreGained: z.number(),
  totalScore: z.number(),
  answerMs: z.number(),
  /** Si quedan preguntas, el cliente pide la siguiente con POST /solo/next. */
  hasNext: z.boolean(),
  finished: z
    .object({
      totalScore: z.number(),
      correctCount: z.number(),
      avgAnswerMs: z.number(),
      xpEarned: z.number(),
      newTotalXp: z.number(),
      newLevel: z.number(),
      leveledUp: z.boolean(),
      perfect: z.boolean(),
    })
    .nullable(),
});
export type SoloAnswerResponse = z.infer<typeof SoloAnswerResponseSchema>;
