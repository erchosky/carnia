import { Injectable } from '@nestjs/common';
import type { QuestionCategory } from '@carnia/db';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { FullQuestion } from '../game/engine/match-state';

export type { FullQuestion };

interface QuestionCache {
  byId: Map<string, FullQuestion>;
  allIds: string[];
  byCategory: Map<QuestionCategory, string[]>;
}

/**
 * Banco de preguntas cacheado en memoria del proceso.
 * Las preguntas cambian solo con el seed, así que se cargan una vez.
 */
@Injectable()
export class QuestionsService {
  private cache: Promise<QuestionCache> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Carga única; las llamadas concurrentes comparten la misma promesa. */
  private load(): Promise<QuestionCache> {
    if (!this.cache) {
      this.cache = this.fetchAll().catch((err) => {
        this.cache = null;
        throw err;
      });
    }
    return this.cache;
  }

  private async fetchAll(): Promise<QuestionCache> {
    const questions = await this.prisma.question.findMany({
      where: { active: true },
      include: { options: { orderBy: { position: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    const byId = new Map<string, FullQuestion>();
    const byCategory = new Map<QuestionCategory, string[]>();
    for (const q of questions) {
      byId.set(q.id, q);
      byCategory.set(q.category, [...(byCategory.get(q.category) ?? []), q.id]);
    }
    return { byId, allIds: questions.map((q) => q.id), byCategory };
  }

  /**
   * Elige `count` preguntas al azar.
   * - `categories`: unión de categorías (PvP). Vacío/null = todas.
   * - `category`: una categoría (Solo); si no llega a `count`, se completa con otras.
   * - `trapOnly`: solo preguntas trampa.
   */
  async pickForMatch(opts: {
    count: number;
    category?: QuestionCategory | 'MIXED';
    categories?: QuestionCategory[] | null;
    trapOnly?: boolean;
  }): Promise<FullQuestion[]> {
    const cache = await this.load();

    let pool: string[];
    if (opts.categories && opts.categories.length > 0) {
      pool = opts.categories.flatMap((cat) => cache.byCategory.get(cat) ?? []);
    } else if (opts.category && opts.category !== 'MIXED') {
      const catPool = cache.byCategory.get(opts.category) ?? [];
      if (catPool.length < opts.count) {
        const inCategory = new Set(catPool);
        pool = [...catPool, ...cache.allIds.filter((id) => !inCategory.has(id))];
      } else {
        pool = catPool;
      }
    } else {
      pool = cache.allIds;
    }

    if (opts.trapOnly) pool = pool.filter((id) => cache.byId.get(id)?.isTrap);

    return sampleN(pool, opts.count).map((id) => cache.byId.get(id)!);
  }

  /** Todas las preguntas activas, opcionalmente de una sola categoría, en orden estable. */
  async getAll(category?: QuestionCategory): Promise<FullQuestion[]> {
    const cache = await this.load();
    const ids = category ? cache.byCategory.get(category) ?? [] : cache.allIds;
    return ids.map((id) => cache.byId.get(id)!);
  }

  async getByIds(ids: string[]): Promise<FullQuestion[]> {
    const cache = await this.load();
    return ids.map((id) => cache.byId.get(id)).filter((q): q is FullQuestion => q !== undefined);
  }

  async getById(id: string): Promise<FullQuestion | null> {
    const cache = await this.load();
    return cache.byId.get(id) ?? null;
  }
}

/** Muestra aleatoria sin reemplazo (Fisher–Yates parcial). */
function sampleN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, take);
}
