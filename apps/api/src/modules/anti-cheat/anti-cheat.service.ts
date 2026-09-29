import { Injectable, Logger } from '@nestjs/common';
import { GAME } from '@carnia/contracts';
import type { MatchState } from '../game/engine/match-state';

export interface SuspicionReport {
  userId: string;
  matchId: string;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
  avgAnswerMs: number;
  accuracy: number;
  fastestAnswerMs: number;
  uniformityStdDev: number;
}

/**
 * Heurísticas server-side para detectar bots / clientes modificados.
 *
 * Niveles:
 * - low: anomalía estadística leve (log, no acción)
 * - medium: patrón consistente (log + flag para revisión)
 * - high: imposible para humano (log + tagging — más tarde: void el match)
 *
 * Filosofía V1: detectar y loguear, NO bloquear automáticamente.
 * Acciones (ban, void match) se hacen offline tras revisar señales.
 */
@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger('AntiCheat');

  /** Analiza un match recién finalizado. Llamado desde el orchestrator. */
  analyze(state: MatchState): SuspicionReport[] {
    const reports: SuspicionReport[] = [];
    for (const player of state.players) {
      const answers = state.rounds.flatMap((r) => {
        const a = r.answers[player.userId];
        return a && a.optionId !== null ? [a] : [];
      });
      if (answers.length < 5) continue;

      const correctCount = answers.filter((a) => a.isCorrect).length;
      const accuracy = correctCount / answers.length;
      const avgAnswerMs = answers.reduce((s, a) => s + a.answerMs, 0) / answers.length;
      const fastestAnswerMs = Math.min(...answers.map((a) => a.answerMs));
      const variance =
        answers.reduce((s, a) => s + (a.answerMs - avgAnswerMs) ** 2, 0) / answers.length;
      const uniformityStdDev = Math.sqrt(variance);

      const reasons: string[] = [];
      let severity: SuspicionReport['severity'] = 'low';

      // Patrón 1: respuestas siempre cerca del mínimo permitido
      if (avgAnswerMs < GAME.MIN_ANSWER_MS + 100 && accuracy > 0.8) {
        reasons.push('avg_answer_near_min_with_high_accuracy');
        severity = 'high';
      }

      // Patrón 2: muy rápido + alta precisión
      if (avgAnswerMs < 800 && accuracy >= 0.9) {
        reasons.push('fast_and_accurate');
        if (severity === 'low') severity = 'medium';
      }

      // Patrón 3: timing demasiado uniforme (bot con sleep fijo)
      if (uniformityStdDev < 80 && answers.length >= 8) {
        reasons.push('uniform_timing');
        if (severity === 'low') severity = 'medium';
      }

      // Patrón 4: la primera respuesta es la más rápida sospechosamente
      if (fastestAnswerMs < GAME.MIN_ANSWER_MS + 50 && accuracy >= 0.7) {
        reasons.push('suspiciously_fast_first_answer');
      }

      if (reasons.length === 0) continue;

      const report: SuspicionReport = {
        userId: player.userId,
        matchId: state.matchId,
        reasons,
        severity,
        avgAnswerMs: Math.round(avgAnswerMs),
        accuracy: Math.round(accuracy * 100) / 100,
        fastestAnswerMs,
        uniformityStdDev: Math.round(uniformityStdDev),
      };

      reports.push(report);

      this.logger.warn(
        {
          tag: 'anti_cheat',
          ...report,
        },
        `suspicion[${severity}] user=${player.userId} match=${state.matchId} reasons=${reasons.join(',')}`,
      );
    }

    return reports;
  }
}
