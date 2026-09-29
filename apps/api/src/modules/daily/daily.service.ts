import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@carnia/db';
import {
  GAME,
  type DailyChallenge,
  type DailyLeaderboardEntry,
  type DailyStatus,
  type DailySubmitInput,
  type DailySubmitResult,
} from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { toPublicQuestion } from '../questions/question-mappers';
import { AchievementsService } from '../achievements/achievements.service';
import { computeStreak, seededShuffle, utcDay } from './daily-utils';

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly achievements: AchievementsService,
  ) {}

  /** Reto de hoy; se crea la primera vez que alguien lo pide. */
  async getToday(): Promise<DailyChallenge> {
    const date = utcDay();
    const challenge = await this.getOrCreateChallenge(date);
    const questions = await this.questions.getByIds(challenge.questionIds);
    return { date, questions: questions.map(toPublicQuestion) };
  }

  async getStatus(userId: string): Promise<DailyStatus> {
    const date = utcDay();
    const [entry, streak] = await Promise.all([
      this.prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } }),
      this.streakFor(userId, date),
    ]);
    return {
      completed: !!entry,
      entry: entry
        ? { score: entry.score, correctCount: entry.correctCount, completedAt: entry.completedAt.toISOString() }
        : null,
      streak,
    };
  }

  async submit(userId: string, answers: DailySubmitInput['answers']): Promise<DailySubmitResult> {
    const date = utcDay();
    const challenge = await this.prisma.dailyChallenge.findUnique({ where: { date } });
    if (!challenge) {
      throw new BadRequestException({ code: 'no_challenge', message: 'No hay reto para hoy' });
    }

    const byQuestion = new Map(answers.map((a) => [a.questionId, a.optionId]));
    const questions = await this.questions.getByIds(challenge.questionIds);
    const results = questions.map((q) => {
      const correctOptionId = q.options.find((o) => o.isCorrect)?.id ?? '';
      const yourOptionId = byQuestion.get(q.id) ?? null;
      return { questionId: q.id, isCorrect: yourOptionId === correctOptionId, correctOptionId, yourOptionId };
    });
    const correctCount = results.filter((r) => r.isCorrect).length;
    const score = correctCount * GAME.DAILY_POINTS_PER_CORRECT;

    try {
      await this.prisma.dailyEntry.create({ data: { userId, date, score, correctCount } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException({ code: 'already_submitted', message: 'Ya completaste el reto de hoy' });
      }
      throw err;
    }

    const streak = await this.streakFor(userId, date);
    void this.achievements.checkAndAward(userId, { dailyStreak: streak });

    return { results, score, correctCount, total: questions.length, streak };
  }

  async getLeaderboard(date: string = utcDay()): Promise<DailyLeaderboardEntry[]> {
    const entries = await this.prisma.dailyEntry.findMany({
      where: { date },
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
      take: 10,
      include: { user: { select: { username: true, avatarUrl: true, level: true } } },
    });
    return entries.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      username: e.user.username,
      avatarUrl: e.user.avatarUrl,
      level: e.user.level,
      score: e.score,
      correctCount: e.correctCount,
      completedAt: e.completedAt.toISOString(),
    }));
  }

  private async getOrCreateChallenge(date: string) {
    const existing = await this.prisma.dailyChallenge.findUnique({ where: { date } });
    if (existing) return existing;

    const all = await this.questions.getAll();
    const questionIds = seededShuffle(
      all.map((q) => q.id),
      date,
    ).slice(0, GAME.DAILY_QUESTION_COUNT);
    // upsert: dos peticiones simultáneas a medianoche no deben chocar con el índice único.
    return this.prisma.dailyChallenge.upsert({
      where: { date },
      update: {},
      create: { date, questionIds },
    });
  }

  private async streakFor(userId: string, today: string): Promise<number> {
    const entries = await this.prisma.dailyEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
      take: 400,
    });
    return computeStreak(
      entries.map((e) => e.date),
      today,
    );
  }
}
