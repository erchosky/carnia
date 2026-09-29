import { Injectable } from '@nestjs/common';
import type { MatchMode, RoomConfig } from '@carnia/contracts';
import type { MatchState } from '../../game/engine/match-state';

export interface StoredRoomMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  ready: boolean;
  socketId: string | null;
}

export interface StoredRoom {
  id: string;
  code: string;
  mode: MatchMode;
  status: 'LOBBY' | 'STARTING' | 'IN_MATCH' | 'FINISHED' | 'ABANDONED';
  hostId: string;
  maxPlayers: number;
  members: StoredRoomMember[];
  matchId: string | null;
  createdAt: number;
  /** Momento en que terminó el último match (para limitar reconexiones a salas viejas). */
  finishedAt: number | null;
  rematchRequests: Set<string>;
  config: RoomConfig;
}

/**
 * Store en memoria. Single-node.
 * Para multi-node, swap a Redis implementando la misma interface:
 *   `room:{id}` (Hash) + `room:code:{code}` (string→id) + `match:{id}:state` (JSON).
 */
@Injectable()
export class RoomStore {
  private rooms = new Map<string, StoredRoom>();
  private codeToRoom = new Map<string, string>();
  private matchStates = new Map<string, MatchState>();
  private socketIndex = new Map<string, { roomId: string; userId: string }>();
  /** userId → roomId. Permite reconnect tras refresh/reload. */
  private userRoomIndex = new Map<string, string>();

  create(room: StoredRoom): void {
    this.rooms.set(room.id, room);
    this.codeToRoom.set(room.code, room.id);
  }

  get(roomId: string): StoredRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  getByCode(code: string): StoredRoom | null {
    const id = this.codeToRoom.get(code);
    return id ? this.rooms.get(id) ?? null : null;
  }

  destroy(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.codeToRoom.delete(room.code);
    // Limpia el userRoomIndex de todos los miembros — la room ya no existe.
    for (const m of room.members) this.userRoomIndex.delete(m.userId);
    this.rooms.delete(roomId);
    if (room.matchId) this.matchStates.delete(room.matchId);
  }

  setMatchState(state: MatchState): void {
    this.matchStates.set(state.matchId, state);
  }

  getMatchState(matchId: string): MatchState | null {
    return this.matchStates.get(matchId) ?? null;
  }

  removeMatchState(matchId: string): void {
    this.matchStates.delete(matchId);
  }

  // Reverse-lookup: dado un socket conectado, encontrar la room/user.
  trackSocket(socketId: string, roomId: string, userId: string): void {
    this.socketIndex.set(socketId, { roomId, userId });
    this.userRoomIndex.set(userId, roomId);
  }

  untrackSocket(socketId: string): { roomId: string; userId: string } | null {
    const entry = this.socketIndex.get(socketId) ?? null;
    this.socketIndex.delete(socketId);
    // No borramos del userRoomIndex aquí — queremos permitir reconnect.
    // Se borra explícitamente cuando el user sale de la room (`releaseUser`).
    return entry;
  }

  findSocket(socketId: string): { roomId: string; userId: string } | null {
    return this.socketIndex.get(socketId) ?? null;
  }

  /** Última room conocida del usuario. Usado para reconectar tras refresh. */
  findUserRoom(userId: string): string | null {
    return this.userRoomIndex.get(userId) ?? null;
  }

  /** Libera definitivamente al usuario (al hacer leave explícito o cerrar room). */
  releaseUser(userId: string): void {
    this.userRoomIndex.delete(userId);
  }
}
