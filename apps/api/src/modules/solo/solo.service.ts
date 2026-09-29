import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  GAME,
  computeScore,
  matchXp,
  type SoloAnswerInput,
  type SoloAnswerResponse,
  type SoloRound,
  type SoloStartInput,
  type SoloStartResponse,
} from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { toPublicQuestion } from '../questions/question-mappers';
import { UsersService } from '../users/users.service';
import { AchievementsService } from '../achievements/achievements.service';

interface SoloRoundState {
  questionId: string;
  startedAt: number;
  isCorrect: boolean;
  answerMs: number;
  closed: boolean;
}

interface SoloSession {
  id: string;
  userId: string;
  matchId: string;
  questionIds: string[];
  rounds: SoloRoundState[];
  totalScore: number;
  createdAt: number;
  lastActivityAt: number;
  trapOnly: boolean;
}

/** Sesiones sin actividad durante este tiempo se descartan. */
const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Modo Solo. Las sesiones viven en memoria del proceso: si la API escala a varias
 * instancias hace falta afinidad o mover este estado a Redis.
 */
@Injectable()
export class SoloService implements OnModuleDestroy {
  private readonly logger = new Logger('SoloService');
  private readonly sessions = new Map<string, SoloSession>();
  private readonly sweeper = setInterval(() => this.sweepIdleSessions(), SWEEP_INTERVAL_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly users: UsersService,
    private readonly achievements: AchievementsService,
  ) {
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  async start(userId: string, input: SoloStartInput): Promise<SoloStartResponse> {
    const count = GAME.QUESTIONS_PER_MATCH;
    const picked = await this.questions.pickForMatch({
      count,
      category: input.category,
      trapOnly: input.trapOnly,
    });
    if (picked.length < count) {
      const label = input.trapOnly ? 'preguntas trampa' : 'preguntas en esa categoría';
      throw new BadRequestException({
        code: 'not_enough_questions',
        message: `Solo hay ${picked.length} ${label}. Prueba con "Mezcla total".`,
      });
    }

    const match = await this.prisma.match.create({
      data: {
        mode: 'SOLO',
        status: 'IN_PROGRESS',
        player1Id: userId,
        questionCount: picked.length,
        participants: { create: { userId } },
      },
    });

    const now = Date.now();
    const session: SoloSession = {
      id: randomBytes(12).toString('base64url'),
      userId,
      matchId: match.id,
      questionIds: picked.map((q) => q.id),
      rounds: [],
      totalScore: 0,
      createdAt: now,
      lastActivityAt: now,
      trapOnly: input.trapOnly,
    };
    this.sessions.set(session.id, session);

    return {
      sessionId: session.id,
      totalQuestions: picked.length,
      ...(await this.openRound(session)),
    };
  }

  /** Abre la siguiente pregunta. El cronómetro empieza aquí, no al responder la anterior. */
  async next(userId: string, sessionId: string): Promise<SoloRound> {
    const session = this.getOwnedSession(userId, sessionId);
    const last = session.rounds.at(-1);
    if (last && !last.closed) return this.describeRound(session, session.rounds.length - 1);
    if (session.rounds.length >= session.questionIds.length) {
      throw new BadRequestException({ code: 'no_more_questions', message: 'La partida ya terminó' });
    }
    return this.openRound(session);
  }

  async answer(userId: string, input: SoloAnswerInput): Promise<SoloAnswerResponse> {
    const session = this.getOwnedSession(userId, input.sessionId);
    if (input.roundIndex !== session.rounds.length - 1) {
      throw new BadRequestException({ code: 'round_out_of_sync', message: 'Ronda desincronizada' });
    }
    const round = session.rounds[input.roundIndex]!;
    if (round.closed) {
      throw new BadRequestException({ code: 'already_answered', message: 'Ronda ya cerrada' });
    }
    // Se cierra antes de cualquier await: una petición duplicada concurrente verá la ronda cerrada.
    round.closed = true;
    session.lastActivityAt = Date.now();

    const elapsed = Date.now() - round.startedAt;
    const question = await this.questions.getById(round.questionId);
    if (!question) throw new NotFoundException();
    const correctOption = question.options.find((o) => o.isCorrect);
    if (!correctOption) throw new Error(`question_no_correct_option:${question.id}`);

    const validTiming =
      elapsed >= GAME.MIN_ANSWER_MS && elapsed <= GAME.QUESTION_DURATION_MS + GAME.ANSWER_GRACE_MS;
    const isCorrect = validTiming && input.optionId === correctOption.id;
    const scoreGained = isCorrect ? computeScore(elapsed) : 0;

    round.isCorrect = isCorrect;
    round.answerMs = Math.min(elapsed, GAME.QUESTION_DURATION_MS);
    session.totalScore += scoreGained;

    await this.prisma.matchAnswer.create({
      data: {
        matchId: session.matchId,
        userId,
        questionId: question.id,
        optionId: input.optionId,
        isCorrect,
        answerMs: round.answerMs,
        scoreGained,
        roundIndex: input.roundIndex,
      },
    });

    const hasNext = session.rounds.length < session.questionIds.length;
    return {
      roundIndex: input.roundIndex,
      isCorrect,
      correctOptionId: correctOption.id,
      explanation: question.explanation,
      scoreGained,
      totalScore: session.totalScore,
      answerMs: round.answerMs,
      hasNext,
      finished: hasNext ? null : await this.finalize(session),
    };
  }

  private getOwnedSession(userId: string, sessionId: string): SoloSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException({ code: 'session_not_found', message: 'Sesión no encontrada o caducada' });
    }
    if (session.userId !== userId) {
      throw new ForbiddenException({ code: 'forbidden', message: 'Sesión ajena' });
    }
    return session;
  }

  private async openRound(session: SoloSession): Promise<SoloRound> {
    const index = session.rounds.length;
    session.rounds.push({
      questionId: session.questionIds[index]!,
      startedAt: Date.now(),
      isCorrect: false,
      answerMs: 0,
      closed: false,
    });
    session.lastActivityAt = Date.now();
    return this.describeRound(session, index);
  }

  private async describeRound(session: SoloSession, index: number): Promise<SoloRound> {
    const round = session.rounds[index]!;
    const question = await this.questions.getById(round.questionId);
    if (!question) throw new NotFoundException({ code: 'question_missing', message: 'Pregunta no disponible' });
    return {
      question: toPublicQuestion(question),
      roundIndex: index,
      serverStartedAt: round.startedAt,
      durationMs: GAME.QUESTION_DURATION_MS,
    };
  }

  private async finalize(session: SoloSession): Promise<NonNullable<SoloAnswerResponse['finished']>> {
    this.sessions.delete(session.id);
    const total = session.rounds.length;
    const correctCount = session.rounds.filter((r) => r.isCorrect).length;
    const avgAnswerMs = Math.round(session.rounds.reduce((sum, r) => sum + r.answerMs, 0) / total);
    const perfect = correctCount === total;
    const xpEarned = matchXp({ correctCount, totalRounds: total, isWinner: false });

    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: session.matchId },
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          durationMs: Date.now() - session.createdAt,
          winnerId: session.userId,
        },
      }),
      this.prisma.matchParticipant.update({
        where: { matchId_userId: { matchId: session.matchId, userId: session.userId } },
        data: { score: session.totalScore, correctCount, avgAnswerMs, xpEarned },
      }),
    ]);

    const { newXp, newLevel, leveledUp } = await this.users.addXp(session.userId, xpEarned);

    // Los logros nunca bloquean la respuesta.
    void this.achievements.checkAndAward(session.userId, {
      matchId: session.matchId,
      correctCount,
      totalRounds: total,
      isSoloMode: true,
      isTrapMode: session.trapOnly,
    });

    return {
      totalScore: session.totalScore,
      correctCount,
      avgAnswerMs,
      xpEarned,
      newTotalXp: newXp,
      newLevel,
      leveledUp,
      perfect,
    };
  }

  private sweepIdleSessions(): void {
    const cutoff = Date.now() - SESSION_IDLE_TTL_MS;
    const expired = [...this.sessions.values()].filter((s) => s.lastActivityAt < cutoff);
    if (expired.length === 0) return;
    for (const s of expired) this.sessions.delete(s.id);
    this.prisma.match
      .updateMany({
        where: { id: { in: expired.map((s) => s.matchId) }, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED', endedAt: new Date() },
      })
      .catch((err) => this.logger.warn(`failed to mark solo matches abandoned: ${(err as Error).message}`));
    this.logger.log(`Discarded ${expired.length} idle solo sessions`);
  }
}
