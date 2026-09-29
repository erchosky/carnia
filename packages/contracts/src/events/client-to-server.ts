import type { MatchMode } from '../schemas/match.js';
import type { RoomConfig } from '../schemas/room.js';

export type AckOk<T = unknown> = { ok: true; data: T };
export type AckErr = { ok: false; code: string; message: string };
export type Ack<T = unknown> = AckOk<T> | AckErr;
export type AckFn<T = unknown> = (response: Ack<T>) => void;

export interface ClientToServerEvents {
  'room:create': (
    p: { mode: MatchMode; config?: RoomConfig },
    ack: AckFn<{ code: string; roomId: string }>,
  ) => void;
  'room:join': (p: { code: string }, ack: AckFn<{ roomId: string }>) => void;
  'room:leave': () => void;
  'room:ready': (p: { ready: boolean }) => void;
  'match:answer': (
    p: { matchId: string; roundIndex: number; optionId: string },
    ack: AckFn<{ accepted: boolean }>,
  ) => void;
  'match:resync': (p: { matchId: string }) => void;
  'match:rematch': (p: { accept: boolean }) => void;
  'queue:join': (p: { mode?: 'STANDARD' }) => void;
  'queue:leave': () => void;
}
