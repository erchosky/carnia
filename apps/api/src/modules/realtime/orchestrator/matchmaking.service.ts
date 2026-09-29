import { Injectable, Logger } from '@nestjs/common';
import { MatchOrchestratorService, type RoomPlayer } from './match-orchestrator.service';

export interface QueueEntry extends RoomPlayer {
  socketId: string;
  joinedAt: number;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger('Matchmaking');
  private queue = new Map<string, QueueEntry>();

  constructor(private readonly orchestrator: MatchOrchestratorService) {}

  joinQueue(user: RoomPlayer, socketId: string): void {
    if (this.queue.has(user.userId)) return; // already in queue
    this.queue.set(user.userId, { ...user, socketId, joinedAt: Date.now() });
    this.logger.log(`User ${user.userId} joined matchmaking queue. Size: ${this.queue.size}`);
    this.tryMatch();
  }

  leaveQueue(userId: string): void {
    this.queue.delete(userId);
    this.logger.log(`User ${userId} left matchmaking queue. Size: ${this.queue.size}`);
  }

  getPosition(userId: string): number {
    let pos = 0;
    for (const [id] of this.queue) {
      pos++;
      if (id === userId) return pos;
    }
    return -1; // not in queue
  }

  private tryMatch(): void {
    if (this.queue.size < 2) return;
    const entries = [...this.queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const player1 = entries[0]!;
    const player2 = entries[1]!;

    // Remove from queue before creating match (avoid double-match)
    this.queue.delete(player1.userId);
    this.queue.delete(player2.userId);

    this.logger.log(`Matched ${player1.userId} vs ${player2.userId}`);

    // Create a room for them and start immediately
    this.orchestrator.createMatchedRoom(player1, player2).catch((err) => {
      this.logger.error('createMatchedRoom failed', err);
      // Re-add to queue on failure
      this.queue.set(player1.userId, player1);
      this.queue.set(player2.userId, player2);
    });
  }

  onDisconnect(userId: string): void {
    this.queue.delete(userId);
  }
}
