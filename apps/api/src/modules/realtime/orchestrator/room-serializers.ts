import type { RoomMember, RoomState } from '@carnia/contracts';
import type { StoredRoom, StoredRoomMember } from './room-store';

export function toRoomMember(m: StoredRoomMember): RoomMember {
  return {
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    level: m.level,
    ready: m.ready,
    connected: m.socketId !== null,
  };
}

export function toRoomState(room: StoredRoom): RoomState {
  return {
    id: room.id,
    code: room.code,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    members: room.members.map(toRoomMember),
    createdAt: new Date(room.createdAt).toISOString(),
  };
}
