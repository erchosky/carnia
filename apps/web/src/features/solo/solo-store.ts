import { create } from 'zustand';
import type { QuestionPublic, SoloAnswerResponse, SoloRound, SoloStartResponse } from '@carnia/contracts';
import { localStartFromServer } from '@/features/quiz/use-countdown';

export interface RoundState {
  question: QuestionPublic;
  roundIndex: number;
  /** Inicio en reloj local. */
  startedAt: number;
  durationMs: number;
}

export interface RoundResult {
  isCorrect: boolean;
  correctOptionId: string;
  pickedOptionId: string | null;
  explanation: string;
  scoreGained: number;
  answerMs: number;
}

export type Phase = 'idle' | 'question' | 'reveal' | 'finished';

type Summary = NonNullable<SoloAnswerResponse['finished']>;

interface SoloState {
  sessionId: string | null;
  totalQuestions: number;
  totalScore: number;
  phase: Phase;
  round: RoundState | null;
  pickedOptionId: string | null;
  lastResult: RoundResult | null;
  hasNext: boolean;
  summary: Summary | null;

  start: (p: SoloStartResponse) => void;
  pickOption: (optionId: string) => void;
  applyAnswer: (r: SoloAnswerResponse) => void;
  openRound: (r: SoloRound) => void;
  showSummary: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  totalQuestions: 0,
  totalScore: 0,
  phase: 'idle' as Phase,
  round: null,
  pickedOptionId: null,
  lastResult: null,
  hasNext: false,
  summary: null,
};

function toRoundState(r: SoloRound): RoundState {
  return {
    question: r.question,
    roundIndex: r.roundIndex,
    startedAt: localStartFromServer(r.serverStartedAt),
    durationMs: r.durationMs,
  };
}

export const useSoloStore = create<SoloState>((set) => ({
  ...initialState,

  start: (p) =>
    set({
      ...initialState,
      sessionId: p.sessionId,
      totalQuestions: p.totalQuestions,
      phase: 'question',
      round: toRoundState(p),
    }),

  pickOption: (optionId) => set({ pickedOptionId: optionId }),

  applyAnswer: (r) =>
    set((state) => ({
      lastResult: {
        isCorrect: r.isCorrect,
        correctOptionId: r.correctOptionId,
        pickedOptionId: state.pickedOptionId,
        explanation: r.explanation,
        scoreGained: r.scoreGained,
        answerMs: r.answerMs,
      },
      totalScore: r.totalScore,
      hasNext: r.hasNext,
      phase: 'reveal',
      summary: r.finished,
    })),

  openRound: (r) =>
    set({ phase: 'question', round: toRoundState(r), pickedOptionId: null, lastResult: null }),

  showSummary: () => set((state) => (state.summary ? { phase: 'finished' } : state)),

  reset: () => set(initialState),
}));
