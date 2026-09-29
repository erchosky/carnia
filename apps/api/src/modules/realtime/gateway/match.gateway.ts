import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { z } from 'zod';
import { RoomConfigSchema, type Ack } from '@carnia/contracts';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RateLimiterService } from '../../../common/rate-limiter/rate-limiter.service';
import { MatchOrchestratorService } from '../orchestrator/match-orchestrator.service';
import { MatchmakingService } from '../orchestrator/matchmaking.service';
import { buildSocketAuthMiddleware } from './socket-auth.middleware';
import type { TypedServer, TypedSocket } from './typed-socket';

/**
 * Limits por evento. Pensados para casos de uso reales:
 * - room:create/join: 5 por minuto (evita spam de salas)
 * - room:ready/leave: 30 por minuto (interacción humana normal)
 * - match:answer: 30 por minuto (10 preguntas + retries; superior es bot)
 * - match:resync: 10 por minuto (no debería pasar de 1-2)
 * - match:rematch: 5 por minuto
 * - queue:join: 10 por minuto
 */
const LIMITS = {
  create: { bucket: 'ws:room_create', limit: 5, windowMs: 60_000 },
  join: { bucket: 'ws:room_join', limit: 10, windowMs: 60_000 },
  ready: { bucket: 'ws:room_ready', limit: 30, windowMs: 60_000 },
  answer: { bucket: 'ws:match_answer', limit: 30, windowMs: 60_000 },
  resync: { bucket: 'ws:match_resync', limit: 10, windowMs: 60_000 },
  rematch: { bucket: 'ws:match_rematch', limit: 5, windowMs: 60_000 },
  queueJoin: { bucket: 'ws:queue_join', limit: 10, windowMs: 60_000 },
} as const;

const RoomCreateSchema = z.object({
  mode: z.enum(['PVP_1V1', 'RANKED', 'CUSTOM']),
  config: RoomConfigSchema.optional(),
});
const RoomJoinSchema = z.object({ code: z.string().trim().min(4).max(8) });
const ReadySchema = z.object({ ready: z.boolean() });
const AnswerSchema = z.object({
  matchId: z.string(),
  roundIndex: z.number().int().min(0),
  optionId: z.string().min(1),
});
const ResyncSchema = z.object({ matchId: z.string() });
const RematchSchema = z.object({ accept: z.boolean() });
const QueueJoinSchema = z.object({ mode: z.enum(['STANDARD']).optional() });

@WebSocketGateway({
  cors: { origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: false },
})
export class MatchGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('MatchGateway');

  @WebSocketServer()
  io!: TypedServer;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly orchestrator: MatchOrchestratorService,
    private readonly rateLimiter: RateLimiterService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  private async checkLimit(
    socket: TypedSocket,
    cfg: { bucket: string; limit: number; windowMs: number },
  ): Promise<Ack<never> | null> {
    const r = await this.rateLimiter.check({ ...cfg, subject: socket.data.userId });
    if (r.allowed) return null;
    this.logger.warn(
      `rate_limited ${cfg.bucket} userId=${socket.data.userId} resetMs=${r.resetMs}`,
    );
    return { ok: false, code: 'rate_limited', message: 'Vas demasiado rápido. Espera un momento.' };
  }

  /**
   * Sala actual del socket. Si la sala ya no existe o su partida terminó,
   * la abandona para que el usuario pueda crear/unirse a otra sin pulsar "Salir".
   */
  private async activeRoomId(socket: TypedSocket): Promise<string | null> {
    const roomId = socket.data.joinedRoomId;
    if (!roomId) return null;
    if (this.orchestrator.hasRoom(roomId) && !this.orchestrator.isRoomFinished(roomId)) {
      return roomId;
    }
    await this.leave(socket);
    return null;
  }

  private async leave(socket: TypedSocket): Promise<void> {
    const roomId = socket.data.joinedRoomId;
    if (roomId) {
      await socket.leave(roomId);
      socket.data.joinedRoomId = null;
    }
    this.orchestrator.leaveRoom(socket.id);
  }

  private profile(socket: TypedSocket) {
    const { userId, username, avatarUrl, level } = socket.data;
    return { userId, username, avatarUrl, level };
  }

  afterInit(server: TypedServer): void {
    server.use(buildSocketAuthMiddleware(this.jwt, this.prisma));
    this.orchestrator.bindServer(server);
    this.logger.log('Socket gateway initialized');
  }

  async handleConnection(socket: TypedSocket): Promise<void> {
    this.logger.log(`+ ${socket.data.username} (${socket.id})`);

    // Auto-reconnect: si el usuario tenía una sala activa, lo metemos de vuelta
    const reconnectedRoomId = this.orchestrator.tryReconnect(socket.id, socket.data.userId);
    if (reconnectedRoomId) {
      await socket.join(reconnectedRoomId);
      socket.data.joinedRoomId = reconnectedRoomId;
      this.orchestrator.broadcastRoom(reconnectedRoomId);
    }
  }

  handleDisconnect(socket: TypedSocket): void {
    this.logger.log(`- ${socket.data.username} (${socket.id})`);
    this.orchestrator.onSocketDisconnect(socket.id);
    this.matchmaking.onDisconnect(socket.data.userId);
  }

  // ─── ROOM ──────────────────────────────

  @SubscribeMessage('room:create')
  async onRoomCreate(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ code: string; roomId: string }>> {
    const parsed = RoomCreateSchema.safeParse(body);
    if (!parsed.success) return ackErr('validation', 'Datos inválidos');

    const blocked = await this.checkLimit(socket, LIMITS.create);
    if (blocked) return blocked;

    if (await this.activeRoomId(socket)) {
      return ackErr('already_in_room', 'Ya estás en una sala');
    }

    const room = await this.orchestrator.createRoom(
      this.profile(socket),
      parsed.data.mode,
      socket.id,
      parsed.data.config,
    );
    await socket.join(room.id);
    socket.data.joinedRoomId = room.id;
    this.orchestrator.broadcastRoom(room.id);
    return ackOk({ code: room.code, roomId: room.id });
  }

  @SubscribeMessage('room:join')
  async onRoomJoin(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ roomId: string }>> {
    const parsed = RoomJoinSchema.safeParse(body);
    if (!parsed.success) return ackErr('validation', 'Código inválido');

    const blocked = await this.checkLimit(socket, LIMITS.join);
    if (blocked) return blocked;

    if (await this.activeRoomId(socket)) {
      return ackErr('already_in_room', 'Ya estás en una sala');
    }

    try {
      const room = await this.orchestrator.joinRoom(this.profile(socket), parsed.data.code, socket.id);
      await socket.join(room.id);
      socket.data.joinedRoomId = room.id;
      this.orchestrator.broadcastRoom(room.id);
      this.orchestrator.emitMemberJoin(room.id, socket.data.userId);
      return ackOk({ roomId: room.id });
    } catch (err) {
      const e = err as { response?: { code?: string; message?: string }; message?: string };
      return ackErr(e.response?.code ?? 'join_failed', e.response?.message ?? e.message ?? 'No se pudo entrar');
    }
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(@ConnectedSocket() socket: TypedSocket): Promise<void> {
    await this.leave(socket);
  }

  @SubscribeMessage('room:ready')
  async onRoomReady(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = ReadySchema.safeParse(body);
    if (!parsed.success) return;
    const blocked = await this.checkLimit(socket, LIMITS.ready);
    if (blocked) return;
    const roomId = socket.data.joinedRoomId;
    if (!roomId) return;
    this.orchestrator.setReady(roomId, socket.data.userId, parsed.data.ready);
  }

  // ─── MATCH ──────────────────────────────

  @SubscribeMessage('match:answer')
  async onMatchAnswer(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ accepted: boolean }>> {
    const parsed = AnswerSchema.safeParse(body);
    if (!parsed.success) return ackErr('validation', 'Respuesta inválida');

    const blocked = await this.checkLimit(socket, LIMITS.answer);
    if (blocked) return blocked;

    try {
      await this.orchestrator.submitAnswer({
        matchId: parsed.data.matchId,
        userId: socket.data.userId,
        roundIndex: parsed.data.roundIndex,
        optionId: parsed.data.optionId,
      });
      return ackOk({ accepted: true });
    } catch (err) {
      const e = err as { response?: { code?: string; message?: string }; message?: string };
      return ackErr(e.response?.code ?? 'answer_failed', e.response?.message ?? 'Respuesta no aceptada');
    }
  }

  @SubscribeMessage('match:resync')
  async onMatchResync(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = ResyncSchema.safeParse(body);
    if (!parsed.success) return;
    const blocked = await this.checkLimit(socket, LIMITS.resync);
    if (blocked) return;
    this.orchestrator.resync(parsed.data.matchId, socket.data.userId);
  }

  @SubscribeMessage('match:rematch')
  async onMatchRematch(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = RematchSchema.safeParse(body);
    if (!parsed.success) return;
    const blocked = await this.checkLimit(socket, LIMITS.rematch);
    if (blocked) return;
    const roomId = socket.data.joinedRoomId;
    if (!roomId) return;
    this.orchestrator.requestRematch(roomId, socket.data.userId, parsed.data.accept);
  }

  // ─── MATCHMAKING QUEUE ──────────────────────────────────────────

  @SubscribeMessage('queue:join')
  async onQueueJoin(
    @ConnectedSocket() socket: TypedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = QueueJoinSchema.safeParse(body);
    if (!parsed.success) return;

    const blocked = await this.checkLimit(socket, LIMITS.queueJoin);
    if (blocked) return;

    if (await this.activeRoomId(socket)) {
      socket.emit('error', { code: 'already_in_room', message: 'Ya estás en una sala' });
      return;
    }

    this.matchmaking.joinQueue(this.profile(socket), socket.id);

    const position = this.matchmaking.getPosition(socket.data.userId);
    // Only emit position if still in queue (didn't get immediately matched)
    if (position > 0) {
      socket.emit('queue:position', {
        position,
        estimatedWaitMs: (position - 1) * 15_000,
      });
    }
  }

  @SubscribeMessage('queue:leave')
  onQueueLeave(@ConnectedSocket() socket: TypedSocket): void {
    this.matchmaking.leaveQueue(socket.data.userId);
  }
}

function ackOk<T>(data: T): Ack<T> {
  return { ok: true, data };
}
function ackErr(code: string, message: string): Ack<never> {
  return { ok: false, code, message };
}
