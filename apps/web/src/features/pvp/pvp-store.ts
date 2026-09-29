import { create } from 'zustand';
import type {
  MatchEndPayload,
  MatchStartPayload,
  MatchStatePayload,
  QuestionStartPayload,
  RevealPayload,
  RoomConfig,
  RoomMember,
  RoomState,
} from '@carnia/contracts';
import { localStartFromServer } from '@/features/quiz/use-countdown';

export type MatchPhase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'finished';

export interface CurrentRound extends QuestionStartPayload {
  /** Inicio de la ronda en reloj local (corrige el desfase con el servidor). */
  startedAt: number;
}

export interface PvpState {
  room: RoomState | null;
  countdownSeconds: number | null;

  matchId: string | null;
  totalRounds: number;
  players: MatchStartPayload['players'];
  scores: Record<string, number>;
  phase: MatchPhase;
  config: RoomConfig | null;
  lives: Record<string, number> | null;

  currentRound: CurrentRound | null;
  pickedOptionId: string | null;
  opponentAnswered: Record<string, boolean>;

  lastReveal: RevealPayload | null;
  matchEnd: MatchEndPayload | null;
  rematchRequestsFrom: string[];

  setRoom: (room: RoomState) => void;
  patchRoomMember: (m: RoomMember) => void;
  removeRoomMember: (userId: string) => void;
  setReady: (userId: string, ready: boolean) => void;
  setCountdown: (seconds: number) => void;
  setMatchStart: (p: MatchStartPayload) => void;
  setQuestion: (p: QuestionStartPayload, serverNow?: number) => void;
  pickOption: (optionId: string) => void;
  markOpponentAnswered: (userId: string) => void;
  setReveal: (p: RevealPayload) => void;
  setMatchEnd: (p: MatchEndPayload) => void;
  syncMatchState: (p: MatchStatePayload) => void;
  addRematchRequest: (userId: string) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  countdownSeconds: null,
  matchId: null,
  totalRounds: 0,
  players: [],
  scores: {},
  phase: 'lobby' as MatchPhase,
  config: null,
  lives: null,
  currentRound: null,
  pickedOptionId: null,
  opponentAnswered: {},
  lastReveal: null,
  matchEnd: null,
  rematchRequestsFrom: [],
} satisfies Partial<PvpState>;

const mapMembers = (room: RoomState | null, fn: (members: RoomMember[]) => RoomMember[]) =>
  room ? { room: { ...room, members: fn(room.members) } } : {};

export const usePvpStore = create<PvpState>((set) => ({
  ...initialState,

  // En LOBBY no hay cuenta atrás activa (p. ej. alguien salió durante ella).
  setRoom: (room) => set(room.status === 'LOBBY' ? { room, countdownSeconds: null, phase: 'lobby' } : { room }),

  patchRoomMember: (m) =>
    set((s) =>
      mapMembers(s.room, (members) =>
        members.some((x) => x.userId === m.userId)
          ? members.map((x) => (x.userId === m.userId ? m : x))
          : [...members, m],
      ),
    ),

  // Una desconexión no expulsa al miembro: solo lo marca como desconectado.
  removeRoomMember: (userId) =>
    set((s) =>
      mapMembers(s.room, (members) =>
        members.map((m) => (m.userId === userId ? { ...m, connected: false } : m)),
      ),
    ),

  setReady: (userId, ready) =>
    set((s) => mapMembers(s.room, (members) => members.map((m) => (m.userId === userId ? { ...m, ready } : m)))),

  setCountdown: (countdownSeconds) => set({ countdownSeconds, phase: 'countdown' }),

  setMatchStart: (p) =>
    set({
      matchId: p.matchId,
      totalRounds: p.totalRounds,
      players: p.players,
      scores: Object.fromEntries(p.players.map((pl) => [pl.userId, 0])),
      phase: 'countdown',
      countdownSeconds: null,
      config: p.config,
      lives: p.lives ?? null,
      currentRound: null,
      pickedOptionId: null,
      opponentAnswered: {},
      lastReveal: null,
      matchEnd: null,
      rematchRequestsFrom: [],
    }),

  setQuestion: (p, serverNow) =>
    set((s) => ({
      currentRound: { ...p, startedAt: localStartFromServer(p.serverStartedAt, serverNow) },
      // Conserva la elección si es un resync de la misma ronda.
      pickedOptionId: s.currentRound?.roundIndex === p.roundIndex && s.matchId === p.matchId ? s.pickedOptionId : null,
      opponentAnswered: s.currentRound?.roundIndex === p.roundIndex ? s.opponentAnswered : {},
      lastReveal: null,
      matchId: p.matchId,
      totalRounds: p.totalRounds,
      phase: 'question',
    })),

  pickOption: (optionId) => set({ pickedOptionId: optionId }),

  markOpponentAnswered: (userId) =>
    set((s) => ({ opponentAnswered: { ...s.opponentAnswered, [userId]: true } })),

  setReveal: (p) => set({ lastReveal: p, scores: p.scores, phase: 'reveal', ...(p.lives ? { lives: p.lives } : {}) }),

  setMatchEnd: (p) => set({ matchEnd: p, phase: 'finished', scores: p.scores, matchId: p.matchId }),

  syncMatchState: (p) =>
    set((s) => {
      const base = { matchId: p.matchId, totalRounds: p.totalRounds, scores: p.scores, lives: p.lives ?? s.lives };
      const round =
        p.question && p.serverStartedAt !== undefined && p.durationMs !== undefined
          ? {
              matchId: p.matchId,
              roundIndex: p.roundIndex,
              totalRounds: p.totalRounds,
              question: p.question,
              serverStartedAt: p.serverStartedAt,
              durationMs: p.durationMs,
              startedAt: localStartFromServer(p.serverStartedAt, p.serverNow),
            }
          : s.currentRound;
      const sameRound = s.currentRound?.roundIndex === p.roundIndex;
      if (p.phase === 'QUESTION') {
        return { ...base, currentRound: round, phase: 'question', lastReveal: null, pickedOptionId: sameRound ? s.pickedOptionId : null };
      }
      if (p.phase === 'REVEAL' && p.reveal) {
        return { ...base, currentRound: round, phase: 'reveal', lastReveal: p.reveal };
      }
      return base;
    }),

  addRematchRequest: (userId) =>
    set((s) =>
      s.rematchRequestsFrom.includes(userId) ? s : { rematchRequestsFrom: [...s.rematchRequestsFrom, userId] },
    ),

  reset: () => set(initialState),
}));
