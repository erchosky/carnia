import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@carnia/contracts';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
const ACK_TIMEOUT_MS = 8000;

let socketRef: AppSocket | null = null;
const listeners = new Set<() => void>();

function notifySocketChange() {
  for (const listener of listeners) listener();
}

/** Suscripción para `useSyncExternalStore`: avisa cuando se crea o se cierra el socket. */
export function subscribeToSocket(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentSocket(): AppSocket | null {
  return socketRef;
}

/** Socket único de la app. Si ya existe, actualiza el token para la próxima reconexión. */
export function getSocket(token: string): AppSocket {
  if (socketRef) {
    socketRef.auth = { token };
    if (!socketRef.connected) socketRef.connect();
    return socketRef;
  }
  socketRef = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  notifySocketChange();
  return socketRef;
}

export function disconnectSocket(): void {
  socketRef?.disconnect();
  socketRef = null;
  notifySocketChange();
}

type AckData<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [unknown, (res: Ack<infer T>) => void] ? T : never;

/** Emite un evento con ack y lo convierte en promesa (rechaza con el mensaje del servidor). */
export function emitWithAck<E extends keyof ClientToServerEvents>(
  socket: AppSocket,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckData<E>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('El servidor no responde')), ACK_TIMEOUT_MS);
    (socket.emit as (e: string, p: unknown, ack: (r: Ack<AckData<E>>) => void) => void)(event, payload, (res) => {
      clearTimeout(timeout);
      if (res?.ok) resolve(res.data);
      else reject(new Error(res?.message ?? 'Error de conexión'));
    });
  });
}
