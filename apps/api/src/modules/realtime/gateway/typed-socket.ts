import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@carnia/contracts';

export interface SocketData {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  joinedRoomId: string | null;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
