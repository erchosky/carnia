import type { RoomConfig } from '@carnia/contracts';
import type { Question, QuestionOption } from '@carnia/db';

export type MatchPhase = 'COUNTDOWN' | 'QUESTION' | 'REVEAL' | 'FINISHED';

export type FullQuestion = Question & { options: QuestionOption[] };

export interface RoundAnswer {
  optionId: string | null;
  answerMs: number;
  isCorrect: boolean;
  scoreGained: number;
  submittedAt: number;
}

export interface MatchRound {
  index: number;
  question: FullQuestion;
  startedAt: number;
  durationMs: number;
  answers: Record<string, RoundAnswer>;
  closed: boolean;
}

export interface MatchPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface MatchState {
  matchId: string;
  roomId: string;
  mode: 'PVP_1V1' | 'RANKED';
  phase: MatchPhase;
  players: MatchPlayer[];
  scores: Record<string, number>;
  rounds: MatchRound[];
  currentRoundIndex: number;
  totalRounds: number;
  questionsQueue: FullQuestion[];
  startedAt: number;
  finishedAt: number | null;
  config: RoomConfig;
  /** Vidas por jugador; null si el modo no es SURVIVAL. */
  lives: Record<string, number> | null;
}

export interface MatchOutcome {
  winnerId: string | null;
  draw: boolean;
}

export function activeRound(state: MatchState): MatchRound | null {
  if (state.phase !== 'QUESTION' && state.phase !== 'REVEAL') return null;
  return state.rounds[state.currentRoundIndex] ?? null;
}

export function allAnswered(round: MatchRound, playerIds: string[]): boolean {
  return playerIds.every((id) => round.answers[id] !== undefined);
}

/** Respuestas registradas de un jugador en todas las rondas. */
export function answersOf(state: MatchState, userId: string): RoundAnswer[] {
  return state.rounds.flatMap((r) => {
    const a = r.answers[userId];
    return a ? [a] : [];
  });
}
