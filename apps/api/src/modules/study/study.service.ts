import { Injectable } from '@nestjs/common';
import type { QuestionCategory, StudyQuestion } from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { toStudyQuestion } from '../questions/question-mappers';

@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
  ) {}

  /** Preguntas que el usuario más ha fallado, de más a menos. */
  async getWeakSpots(userId: string, limit = 20): Promise<StudyQuestion[]> {
    const wrong = await this.prisma.matchAnswer.groupBy({
      by: ['questionId'],
      where: { userId, isCorrect: false },
      _count: { questionId: true },
      orderBy: { _count: { questionId: 'desc' } },
      take: limit,
    });
    const questions = await this.questions.getByIds(wrong.map((w) => w.questionId));
    const counts = new Map(wrong.map((w) => [w.questionId, w._count.questionId]));
    return questions.map((q) => ({ ...toStudyQuestion(q), wrongCount: counts.get(q.id) ?? 0 }));
  }

  /** Todas las preguntas (o las de una categoría) con la respuesta revelada, barajadas. */
  async getFlashcards(category?: QuestionCategory): Promise<StudyQuestion[]> {
    const questions = await this.questions.getAll(category);
    return shuffle(questions.map(toStudyQuestion));
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
