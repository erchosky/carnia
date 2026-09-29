import type { RoomState, RoomMember, RoomConfig } from '../schemas/room.js';
import type { QuestionPublic } from '../schemas/question.js';

export interface QuestionStartPayload {
  matchId: string;
  roundIndex: number;
  totalRounds: number;
  question: QuestionPublic;
  serverStartedAt: number;
  durationMs: number;
}

export interface RevealAnswer {
  userId: string;
  optionId: string | null;
  answerMs: number | null;
  isCorrect: boolean;
  scoreGained: number;
}

export interface RevealPayload {
  matchId: string;
  roundIndex: number;
  correctOptionId: string;
  explanation: string;
  answers: RevealAnswer[];
  scores: Record<string, number>;
  /** Cuándo el cliente debe avanzar a la próxima ronda (epoch ms) */
  nextRoundAt: number;
  /** Vidas restantes por jugador (solo en modo SURVIVAL) */
  lives?: Record<string, number>;
}

export interface MatchStartPayload {
  matchId: string;
  totalRounds: number;
  players: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    level: number;
  }>;
  serverStartsAt: number;
  config: RoomConfig;
  lives?: Record<string, number>;
}

export interface MatchEndPayload {
  matchId: string;
  winnerId: string | null;
  draw: boolean;
  scores: Record<string, number>;
  correctCounts: Record<string, number>;
  xpEarned: Record<string, number>;
  eloDelta: Record<string, number>;
  newElo: Record<string, number>;
  rematchDeadline: number;
}

export interface MatchStatePayload {
  matchId: string;
  phase: 'COUNTDOWN' | 'QUESTION' | 'REVEAL' | 'FINISHED';
  roundIndex: number;
  totalRounds: number;
  scores: Record<string, number>;
  /** Vidas restantes (solo en modo SURVIVAL) */
  lives?: Record<string, number>;
  /** Si phase === QUESTION, incluye la pregunta activa y el tiempo restante */
  question?: QuestionPublic;
  serverStartedAt?: number;
  durationMs?: number;
  /** Si phase === REVEAL, incluye la información de revelación */
  reveal?: RevealPayload;
  /** Reloj del servidor al emitir; permite al cliente corregir el desfase de reloj. */
  serverNow: number;
}

export interface ServerToClientEvents {
  'room:state': (p: RoomState) => void;
  'room:member_join': (p: RoomMember) => void;
  'room:member_leave': (p: { userId: string }) => void;
  'room:ready_update': (p: { userId: string; ready: boolean }) => void;
  'match:countdown': (p: { secondsLeft: number }) => void;
  'match:start': (p: MatchStartPayload) => void;
  'match:question': (p: QuestionStartPayload) => void;
  'match:opponent_answered': (p: { userId: string; answerMs: number }) => void;
  'match:reveal': (p: RevealPayload) => void;
  'match:end': (p: MatchEndPayload) => void;
  'match:state': (p: MatchStatePayload) => void;
  'match:rematch_request': (p: { userId: string }) => void;
  'match:rematch_declined': (p: { userId: string }) => void;
  error: (p: { code: string; message: string }) => void;
  'queue:position': (p: { position: number; estimatedWaitMs: number }) => void;
  'queue:matched': (p: { matchId: string; roomId: string }) => void;
}
