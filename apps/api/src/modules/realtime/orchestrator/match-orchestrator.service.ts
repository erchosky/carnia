import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  GAME,
  DEFAULT_ROOM_CONFIG,
  type MatchEndPayload,
  type MatchMode,
  type RoomConfig,
} from '@carnia/contracts';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { QuestionsService } from '../../questions/questions.service';
import { toPublicQuestion } from '../../questions/question-mappers';
import {
  advanceAfterReveal,
  buildReveal,
  closeRound,
  initMatchState,
  startNextRound,
  submitAnswer,
  InvalidAnswerError,
} from '../../game/engine/match-engine';
import type { FullQuestion, MatchOutcome, MatchRound, MatchState } from '../../game/engine/match-state';
import type { TypedServer } from '../gateway/typed-socket';
import { generateRoomCode } from './room-codes';
import { RoomStore, type StoredRoom, type StoredRoomMember } from './room-store';
import { toRoomMember, toRoomState } from './room-serializers';
import { TimerRegistry } from './timer-registry';
import { MatchFinalizerService } from './match-finalizer.service';

export interface RoomPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
}

/** Margen del watchdog de ronda sobre la duración de la pregunta. */
const ROUND_WATCHDOG_GRACE_MS = GAME.ANSWER_GRACE_MS;

/**
 * Orquesta salas y partidas PvP en tiempo real. El servidor es autoritativo:
 * valida respuestas, mide tiempos y decide el resultado.
 *
 * - El estado vive en `RoomStore` (memoria, single-node).
 * - Las reglas del juego son funciones puras de `match-engine`.
 * - La persistencia del resultado está en `MatchFinalizerService`.
 */
@Injectable()
export class MatchOrchestratorService implements OnModuleDestroy {
  private readonly logger = new Logger('MatchOrchestrator');
  private io: TypedServer | null = null;
  private readonly timers = new TimerRegistry();
  /** Evita finalizar dos veces el mismo match. */
  private readonly finalizing = new Set<string>();
  /** Cuándo empieza la siguiente ronda de cada match en fase REVEAL (para el resync). */
  private readonly revealEndsAt = new Map<string, number>();
  /** Último match:end de cada match durante la ventana de revancha (para el resync). */
  private readonly endPayloads = new Map<string, MatchEndPayload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly store: RoomStore,
    private readonly finalizer: MatchFinalizerService,
  ) {}

  bindServer(io: TypedServer): void {
    this.io = io;
  }

  onModuleDestroy(): void {
    this.logger.log(`Graceful shutdown — limpiando ${this.timers.size} timers`);
    this.timers.clearAll();
    this.io?.emit('error', {
      code: 'server_restarting',
      message: 'El servidor está reiniciando — reconectando…',
    });
  }

  // ─── ROOM LIFECYCLE ───────────────────────────────────────────

  hasRoom(roomId: string): boolean {
    return this.store.get(roomId) !== null;
  }

  isRoomFinished(roomId: string): boolean {
    return this.store.get(roomId)?.status === 'FINISHED';
  }

  async createRoom(
    host: RoomPlayer,
    mode: MatchMode,
    socketId: string,
    config: RoomConfig = DEFAULT_ROOM_CONFIG,
  ): Promise<StoredRoom> {
    const room = await this.persistNewRoom(host.userId, mode, config, [
      { ...host, ready: false, socketId },
    ]);
    this.store.trackSocket(socketId, room.id, host.userId);
    return room;
  }

  /**
   * Sala para dos jugadores emparejados por la cola: ambos entran listos y
   * la cuenta atrás empieza de inmediato.
   */
  async createMatchedRoom(
    player1: RoomPlayer & { socketId: string },
    player2: RoomPlayer & { socketId: string },
  ): Promise<void> {
    const room = await this.persistNewRoom(player1.userId, 'PVP_1V1', DEFAULT_ROOM_CONFIG, [
      { ...player1, ready: true },
      { ...player2, ready: true },
    ]);

    for (const p of [player1, player2]) {
      this.store.trackSocket(p.socketId, room.id, p.userId);
      const socket = this.io?.sockets.sockets.get(p.socketId);
      if (socket) {
        await socket.join(room.id);
        socket.data.joinedRoomId = room.id;
      }
    }
    this.logger.log(`createMatchedRoom: room=${room.id} p1=${player1.userId} p2=${player2.userId}`);

    // room:state antes que queue:matched para que el cliente ya tenga el código.
    this.broadcastRoom(room.id);
    const matchPayload = { matchId: '', roomId: room.id };
    this.io?.to(player1.socketId).emit('queue:matched', matchPayload);
    this.io?.to(player2.socketId).emit('queue:matched', matchPayload);

    this.startCountdown(room);
  }

  async joinRoom(user: RoomPlayer, code: string, socketId: string): Promise<StoredRoom> {
    const room = this.store.getByCode(code.toUpperCase());
    if (!room) throw new BadRequestException({ code: 'room_not_found', message: 'Sala no encontrada' });

    const existing = room.members.find((m) => m.userId === user.userId);
    if (existing) {
      existing.socketId = socketId;
      this.store.trackSocket(socketId, room.id, user.userId);
      this.timers.clear(`abandon:${room.id}`);
      return room;
    }
    if (room.status !== 'LOBBY') {
      throw new BadRequestException({ code: 'room_not_joinable', message: 'La partida ya empezó' });
    }
    if (room.members.length >= room.maxPlayers) {
      throw new BadRequestException({ code: 'room_full', message: 'Sala llena' });
    }

    room.members.push({ ...user, ready: false, socketId });
    this.store.trackSocket(socketId, room.id, user.userId);
    return room;
  }

  /** Emite room:state a todos en la sala. Llamar después del socket.join. */
  broadcastRoom(roomId: string): void {
    const room = this.store.get(roomId);
    if (room) this.io?.to(roomId).emit('room:state', toRoomState(room));
  }

  /** Notifica la llegada de un miembro nuevo (no en reconexión). */
  emitMemberJoin(roomId: string, userId: string): void {
    const member = this.store.get(roomId)?.members.find((m) => m.userId === userId);
    if (member) this.io?.to(roomId).emit('room:member_join', toRoomMember(member));
  }

  setReady(roomId: string, userId: string, ready: boolean): void {
    const room = this.store.get(roomId);
    if (!room || room.status !== 'LOBBY') return;
    const member = room.members.find((m) => m.userId === userId);
    if (!member) return;
    member.ready = ready;
    this.io?.to(roomId).emit('room:ready_update', { userId, ready });

    if (room.members.length >= 2 && room.members.every((m) => m.ready)) {
      this.startCountdown(room);
    }
  }

  /**
   * Reengancha a un usuario a su sala tras abrir un socket nuevo
   * (refresh, reconexión móvil…). Devuelve el roomId o null.
   */
  tryReconnect(socketId: string, userId: string): string | null {
    const roomId = this.store.findUserRoom(userId);
    if (!roomId) return null;
    const room = this.store.get(roomId);
    const member = room?.members.find((m) => m.userId === userId);
    const staleFinish =
      room?.status === 'FINISHED' &&
      room.finishedAt !== null &&
      Date.now() - room.finishedAt > GAME.REMATCH_TIMEOUT_MS;

    if (!room || !member || room.status === 'ABANDONED' || staleFinish) {
      this.store.releaseUser(userId);
      return null;
    }

    member.socketId = socketId;
    this.store.trackSocket(socketId, roomId, userId);
    this.timers.clear(`abandon:${roomId}`);
    this.setPlayerConnected(room, userId, true);
    this.logger.log(`reconnected user=${userId} room=${roomId}`);
    return roomId;
  }

  /** Caída transitoria del socket: el usuario sigue en la sala y puede reconectar. */
  onSocketDisconnect(socketId: string): void {
    const entry = this.store.untrackSocket(socketId);
    if (!entry) return;
    const room = this.store.get(entry.roomId);
    if (!room) return;

    const member = room.members.find((m) => m.userId === entry.userId);
    // Otro socket del mismo usuario puede haber tomado el relevo.
    if (member && member.socketId === socketId) member.socketId = null;
    this.setPlayerConnected(room, entry.userId, false);
    this.io?.to(room.id).emit('room:member_leave', { userId: entry.userId });
    this.scheduleAbandonIfEmpty(room);
  }

  /** Salida explícita del usuario ("Salir"). Libera su plaza. */
  leaveRoom(socketId: string): void {
    const entry = this.store.untrackSocket(socketId);
    if (!entry) return;
    this.store.releaseUser(entry.userId);
    const room = this.store.get(entry.roomId);
    if (!room) return;

    this.io?.to(room.id).emit('room:member_leave', { userId: entry.userId });

    if (room.status === 'IN_MATCH') {
      // La partida continúa: el jugador queda desconectado y sus rondas expiran.
      const member = room.members.find((m) => m.userId === entry.userId);
      if (member) member.socketId = null;
      this.setPlayerConnected(room, entry.userId, false);
      this.scheduleAbandonIfEmpty(room);
      return;
    }

    room.members = room.members.filter((m) => m.userId !== entry.userId);
    room.rematchRequests.delete(entry.userId);

    if (room.members.length === 0) {
      this.destroyRoom(room, 'ABANDONED');
      return;
    }
    if (room.status === 'STARTING') this.cancelCountdown(room);
    if (room.hostId === entry.userId) room.hostId = room.members[0]!.userId;
    this.broadcastRoom(room.id);
  }

  // ─── MATCH LIFECYCLE ───────────────────────────────────────────

  async submitAnswer(input: {
    matchId: string;
    userId: string;
    roundIndex: number;
    optionId: string;
  }): Promise<void> {
    const state = this.store.getMatchState(input.matchId);
    if (!state) throw new BadRequestException({ code: 'match_not_found', message: 'Match no encontrado' });

    let result: ReturnType<typeof submitAnswer>;
    try {
      result = submitAnswer(state, { ...input, serverNow: Date.now() });
    } catch (err) {
      if (err instanceof InvalidAnswerError) {
        throw new BadRequestException({ code: err.code, message: 'Respuesta inválida' });
      }
      throw err;
    }

    this.store.setMatchState(result.state);
    this.io?.to(state.roomId).emit('match:opponent_answered', {
      userId: input.userId,
      answerMs: result.perPlayerResult.answerMs,
    });

    // Todo este bloque es síncrono: una segunda respuesta ya verá la ronda cerrada.
    if (result.eliminatedUserId) {
      // Eliminado en SURVIVAL: se cierra la ronda sin penalizar al rival que aún no respondió.
      this.revealRound(result.state, { penalizeUnanswered: false });
    } else if (result.closedRound) {
      this.revealRound(result.state);
    }
  }

  requestRematch(roomId: string, userId: string, accept: boolean): void {
    const room = this.store.get(roomId);
    if (!room || room.status !== 'FINISHED') return;

    if (!accept) {
      room.rematchRequests.delete(userId);
      this.io?.to(roomId).emit('match:rematch_declined', { userId });
      return;
    }
    room.rematchRequests.add(userId);
    this.io?.to(roomId).emit('match:rematch_request', { userId });

    const everyoneAccepted =
      room.members.length >= 2 && room.members.every((m) => room.rematchRequests.has(m.userId));
    if (everyoneAccepted) {
      room.rematchRequests.clear();
      room.status = 'LOBBY';
      room.matchId = null;
      room.members.forEach((m) => (m.ready = true));
      this.broadcastRoom(room.id);
      this.startCountdown(room);
    }
  }

  /** Reenvía el estado completo del match a un jugador que vuelve (reconexión o background). */
  resync(matchId: string, userId: string): void {
    const socketId = this.findSocketOfUser(matchId, userId);
    if (!socketId || !this.io) return;

    const ended = this.endPayloads.get(matchId);
    if (ended) {
      this.io.to(socketId).emit('match:end', ended);
      return;
    }

    const state = this.store.getMatchState(matchId);
    if (!state) return;
    const round = state.rounds[state.currentRoundIndex];
    this.io.to(socketId).emit('match:state', {
      matchId: state.matchId,
      phase: state.phase,
      roundIndex: state.currentRoundIndex,
      totalRounds: state.totalRounds,
      scores: state.scores,
      lives: state.lives ?? undefined,
      question: round ? toPublicQuestion(round.question) : undefined,
      serverStartedAt: round?.startedAt,
      durationMs: round?.durationMs,
      reveal:
        round && state.phase === 'REVEAL'
          ? {
              ...buildReveal(state, round),
              matchId: state.matchId,
              nextRoundAt: this.revealEndsAt.get(matchId) ?? Date.now(),
              lives: state.lives ?? undefined,
            }
          : undefined,
      serverNow: Date.now(),
    });
  }

  // ─── INTERNAL: flujo del match ───────────────────────────────────

  private startCountdown(room: StoredRoom): void {
    if (room.status !== 'LOBBY') return;
    room.status = 'STARTING';
    let seconds = Math.ceil(GAME.COUNTDOWN_DURATION_MS / 1000);
    this.io?.to(room.id).emit('match:countdown', { secondsLeft: seconds });

    this.timers.interval(`countdown:${room.id}`, 1000, () => {
      seconds -= 1;
      if (seconds > 0) {
        this.io?.to(room.id).emit('match:countdown', { secondsLeft: seconds });
        return;
      }
      this.timers.clear(`countdown:${room.id}`);
      void this.startMatch(room);
    });
  }

  /** Alguien salió durante la cuenta atrás: se vuelve al lobby. */
  private cancelCountdown(room: StoredRoom): void {
    this.timers.clear(`countdown:${room.id}`);
    room.status = 'LOBBY';
    room.members.forEach((m) => (m.ready = false));
  }

  private async startMatch(room: StoredRoom): Promise<void> {
    if (room.status !== 'STARTING' || !this.store.get(room.id)) return;
    if (room.members.length < 2) {
      this.recoverFromFailedStart(room, 'not_enough_players', 'Falta un jugador');
      return;
    }
    try {
      const { config } = room;
      const questions = await this.questions.pickForMatch({
        count: config.totalRounds,
        categories: config.categories,
      });
      if (questions.length < config.totalRounds) {
        this.recoverFromFailedStart(
          room,
          'not_enough_questions',
          `Solo hay ${questions.length} preguntas para esas categorías`,
        );
        return;
      }
      await this.runStartMatch(room, questions);
    } catch (err) {
      this.logger.error(`startMatch failed for room=${room.id}`, err);
      this.recoverFromFailedStart(room, 'start_failed', 'No se pudo iniciar la partida');
    }
  }

  /** Devuelve la sala a LOBBY tras un fallo al arrancar, para que no quede atascada. */
  private recoverFromFailedStart(room: StoredRoom, code: string, message: string): void {
    if (!this.store.get(room.id)) return;
    room.status = 'LOBBY';
    room.members.forEach((m) => (m.ready = false));
    this.io?.to(room.id).emit('error', { code, message });
    this.broadcastRoom(room.id);
  }

  private async runStartMatch(room: StoredRoom, questions: FullQuestion[]): Promise<void> {
    const [p1, p2] = room.members;
    // Match.roomId es único y la revancha reutiliza la sala: se desvincula el match
    // anterior (conserva su historial) antes de crear el nuevo.
    const [, match] = await this.prisma.$transaction([
      this.prisma.match.updateMany({ where: { roomId: room.id }, data: { roomId: null } }),
      this.prisma.match.create({
        data: {
          roomId: room.id,
          mode: 'PVP_1V1',
          player1Id: p1!.userId,
          player2Id: p2?.userId,
          questionCount: questions.length,
          status: 'IN_PROGRESS',
          participants: { create: room.members.map((m) => ({ userId: m.userId })) },
        },
      }),
      this.prisma.room.update({ where: { id: room.id }, data: { status: 'IN_MATCH' } }),
    ]);
    // Alguien salió mientras se creaba el match: se descarta.
    if (room.status !== 'STARTING' || room.members.length < 2) {
      await this.prisma.match.update({ where: { id: match.id }, data: { status: 'ABANDONED', roomId: null } });
      this.recoverFromFailedStart(room, 'not_enough_players', 'Falta un jugador');
      return;
    }
    room.status = 'IN_MATCH';
    room.matchId = match.id;
    room.finishedAt = null;

    const now = Date.now();
    const initial = initMatchState({
      matchId: match.id,
      roomId: room.id,
      mode: 'PVP_1V1',
      players: room.members.map((m) => ({
        userId: m.userId,
        username: m.username,
        avatarUrl: m.avatarUrl,
        level: m.level,
        connected: m.socketId !== null,
        disconnectedAt: m.socketId !== null ? null : now,
      })),
      questions,
      config: room.config,
      now,
    });
    const { state, nextRound } = startNextRound(initial, now);
    this.store.setMatchState(state);

    this.io?.to(room.id).emit('match:start', {
      matchId: match.id,
      totalRounds: state.totalRounds,
      players: state.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        level: p.level,
      })),
      serverStartsAt: now,
      config: room.config,
      lives: state.lives ?? undefined,
    });

    if (nextRound) this.emitQuestion(state, nextRound);
  }

  private emitQuestion(state: MatchState, round: MatchRound): void {
    this.revealEndsAt.delete(state.matchId);
    this.io?.to(state.roomId).emit('match:question', {
      matchId: state.matchId,
      roundIndex: round.index,
      totalRounds: state.totalRounds,
      question: toPublicQuestion(round.question),
      serverStartedAt: round.startedAt,
      durationMs: round.durationMs,
    });

    // Watchdog: cierra la ronda aunque falte alguna respuesta.
    this.timers.timeout(`question:${state.matchId}`, round.durationMs + ROUND_WATCHDOG_GRACE_MS, () => {
      const current = this.store.getMatchState(state.matchId);
      if (current?.phase === 'QUESTION' && current.currentRoundIndex === round.index) {
        this.revealRound(current);
      }
    });
  }

  private revealRound(state: MatchState, opts: { penalizeUnanswered?: boolean } = {}): void {
    this.timers.clear(`question:${state.matchId}`);
    const { state: revealState, reveal } = closeRound(state, Date.now(), opts);
    this.store.setMatchState(revealState);

    const delayMs =
      state.config.gameMode === 'BLITZ' ? GAME.BLITZ_REVEAL_DURATION_MS : GAME.REVEAL_DURATION_MS;
    const nextRoundAt = Date.now() + delayMs;
    this.revealEndsAt.set(state.matchId, nextRoundAt);

    this.io?.to(state.roomId).emit('match:reveal', {
      ...reveal,
      matchId: state.matchId,
      nextRoundAt,
      lives: revealState.lives ?? undefined,
    });

    this.persistRoundAnswers(revealState).catch((err) =>
      this.logger.error('persistRoundAnswers failed', err),
    );

    this.timers.timeout(`reveal:${state.matchId}`, delayMs, () => this.advanceMatch(state.matchId));
  }

  private advanceMatch(matchId: string): void {
    const state = this.store.getMatchState(matchId);
    if (state?.phase !== 'REVEAL') return;

    const { state: nextState, nextRound, ended } = advanceAfterReveal(state, Date.now());
    this.store.setMatchState(nextState);

    if (nextRound) this.emitQuestion(nextState, nextRound);
    else if (ended) void this.finalizeMatch(nextState, ended);
  }

  private async finalizeMatch(state: MatchState, outcome: MatchOutcome): Promise<void> {
    if (this.finalizing.has(state.matchId)) return;
    this.finalizing.add(state.matchId);
    this.revealEndsAt.delete(state.matchId);

    const room = this.store.get(state.roomId);
    if (room) {
      room.status = 'FINISHED';
      room.finishedAt = Date.now();
    }

    let results;
    try {
      results = await this.finalizer.finalize(state, outcome);
    } catch (err) {
      // Aunque no se guarde, los jugadores deben ver el final y no quedarse colgados.
      this.logger.error(`finalizeMatch persistence failed match=${state.matchId}`, err);
      this.io?.to(state.roomId).emit('error', {
        code: 'results_not_saved',
        message: 'No se pudieron guardar los resultados de la partida',
      });
      results = this.finalizer.summarizeOnly(state, outcome);
    }

    const endPayload: MatchEndPayload = {
      matchId: state.matchId,
      winnerId: outcome.winnerId,
      draw: outcome.draw,
      scores: state.scores,
      ...results,
      rematchDeadline: Date.now() + GAME.REMATCH_TIMEOUT_MS,
    };
    this.endPayloads.set(state.matchId, endPayload);
    this.io?.to(state.roomId).emit('match:end', endPayload);

    // Pasada la ventana de revancha: libera el estado del match y, si nadie
    // pidió revancha, cierra la sala.
    this.timers.timeout(`cleanup:${state.matchId}`, GAME.REMATCH_TIMEOUT_MS + 5000, () => {
      this.store.removeMatchState(state.matchId);
      this.finalizing.delete(state.matchId);
      this.endPayloads.delete(state.matchId);
      const current = this.store.get(state.roomId);
      if (current?.status === 'FINISHED' && current.matchId === state.matchId) {
        this.destroyRoom(current, 'FINISHED');
      }
    });
  }

  private async persistRoundAnswers(state: MatchState): Promise<void> {
    const round = state.rounds[state.currentRoundIndex];
    if (!round) return;
    await this.prisma.$transaction(
      Object.entries(round.answers).map(([userId, a]) =>
        this.prisma.matchAnswer.upsert({
          where: {
            matchId_userId_roundIndex: { matchId: state.matchId, userId, roundIndex: round.index },
          },
          update: {},
          create: {
            matchId: state.matchId,
            userId,
            questionId: round.question.id,
            optionId: a.optionId,
            isCorrect: a.isCorrect,
            answerMs: a.answerMs,
            scoreGained: a.scoreGained,
            roundIndex: round.index,
          },
        }),
      ),
    );
  }

  // ─── INTERNAL: helpers de sala ───────────────────────────────────

  private async persistNewRoom(
    hostId: string,
    mode: MatchMode,
    config: RoomConfig,
    members: StoredRoomMember[],
  ): Promise<StoredRoom> {
    let code = generateRoomCode();
    while (this.store.getByCode(code)) code = generateRoomCode();

    const row = await this.prisma.room.create({ data: { code, hostId, mode } });
    const room: StoredRoom = {
      id: row.id,
      code: row.code,
      mode,
      status: 'LOBBY',
      hostId,
      maxPlayers: 2,
      members,
      matchId: null,
      createdAt: Date.now(),
      finishedAt: null,
      rematchRequests: new Set(),
      config,
    };
    this.store.create(room);
    return room;
  }

  /** Si nadie queda conectado fuera de partida, cierra la sala tras un margen de reconexión. */
  private scheduleAbandonIfEmpty(room: StoredRoom): void {
    if (room.members.some((m) => m.socketId !== null)) return;
    this.timers.timeout(`abandon:${room.id}`, GAME.RECONNECT_GRACE_MS, () => {
      const current = this.store.get(room.id);
      if (!current || current.members.some((m) => m.socketId !== null)) return;
      // Un match en curso termina solo por timeouts; la sala se cerrará al acabar.
      if (current.status === 'IN_MATCH') return;
      this.destroyRoom(current, current.status === 'FINISHED' ? 'FINISHED' : 'ABANDONED');
    });
  }

  private destroyRoom(room: StoredRoom, status: 'ABANDONED' | 'FINISHED'): void {
    // Timers primero: ningún callback debe ver la sala ya destruida.
    this.timers.clear(`countdown:${room.id}`);
    this.timers.clear(`abandon:${room.id}`);
    if (room.matchId) {
      this.timers.clear(`question:${room.matchId}`);
      this.timers.clear(`reveal:${room.matchId}`);
      this.revealEndsAt.delete(room.matchId);
    }
    this.store.destroy(room.id);
    this.io?.in(room.id).socketsLeave(room.id);

    if (status === 'ABANDONED') {
      this.prisma.room
        .update({ where: { id: room.id }, data: { closedAt: new Date(), status } })
        .catch((err) =>
          this.logger.warn(`failed to mark room ${room.id} as ABANDONED: ${(err as Error).message}`),
        );
    }
  }

  private setPlayerConnected(room: StoredRoom, userId: string, connected: boolean): void {
    if (!room.matchId) return;
    const player = this.store.getMatchState(room.matchId)?.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connected = connected;
    player.disconnectedAt = connected ? null : Date.now();
  }

  private findSocketOfUser(matchId: string, userId: string): string | null {
    const state = this.store.getMatchState(matchId);
    const room = state ? this.store.get(state.roomId) : null;
    return room?.members.find((m) => m.userId === userId)?.socketId ?? null;
  }
}
