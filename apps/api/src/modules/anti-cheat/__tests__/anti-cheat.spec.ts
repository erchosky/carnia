import { describe, expect, it } from 'vitest';
import { AntiCheatService } from '../anti-cheat.service';
import type { MatchState } from '../../game/engine/match-state';

function makeState(perPlayerAnswers: Array<{ userId: string; answers: Array<{ ms: number; ok: boolean }> }>): MatchState {
  const rounds = [];
  const maxLen = Math.max(...perPlayerAnswers.map((p) => p.answers.length));
  for (let i = 0; i < maxLen; i++) {
    const answers: Record<string, { optionId: string | null; answerMs: number; isCorrect: boolean; scoreGained: number; submittedAt: number }> = {};
    for (const p of perPlayerAnswers) {
      const a = p.answers[i];
      if (a) {
        answers[p.userId] = {
          optionId: 'opt',
          answerMs: a.ms,
          isCorrect: a.ok,
          scoreGained: a.ok ? 800 : 0,
          submittedAt: 0,
        };
      }
    }
    rounds.push({
      index: i,
      question: { id: `q${i}`, options: [] } as never,
      startedAt: 0,
      durationMs: 15000,
      answers,
      closed: true,
    });
  }
  return {
    matchId: 'm1',
    roomId: 'r1',
    mode: 'PVP_1V1',
    phase: 'FINISHED',
    players: perPlayerAnswers.map((p) => ({
      userId: p.userId,
      username: p.userId,
      avatarUrl: null,
      level: 1,
      connected: true,
      disconnectedAt: null,
    })),
    scores: {},
    rounds,
    currentRoundIndex: maxLen - 1,
    totalRounds: maxLen,
    questionsQueue: [],
    startedAt: 0,
    finishedAt: 1,
  };
}

describe('AntiCheatService', () => {
  const ac = new AntiCheatService();

  it('NO marca a un jugador humano normal', () => {
    const state = makeState([
      {
        userId: 'normal',
        answers: [
          { ms: 4200, ok: true },
          { ms: 6800, ok: false },
          { ms: 3500, ok: true },
          { ms: 9100, ok: true },
          { ms: 5200, ok: true },
          { ms: 7300, ok: false },
          { ms: 4800, ok: true },
        ],
      },
    ]);
    expect(ac.analyze(state)).toHaveLength(0);
  });

  it('marca como HIGH al que responde a ~MIN_ANSWER_MS con >80% acierto', () => {
    const state = makeState([
      {
        userId: 'bot',
        answers: Array.from({ length: 10 }, () => ({ ms: 220, ok: true })),
      },
    ]);
    const reports = ac.analyze(state);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.severity).toBe('high');
    expect(reports[0]?.reasons).toContain('avg_answer_near_min_with_high_accuracy');
  });

  it('marca como MEDIUM al rápido+preciso pero no extremo', () => {
    const state = makeState([
      {
        userId: 'fast_player',
        answers: Array.from({ length: 10 }, (_, i) => ({ ms: 600 + i * 20, ok: i % 10 !== 0 })),
      },
    ]);
    const reports = ac.analyze(state);
    expect(reports.length).toBe(1);
    expect(reports[0]?.severity).toBe('medium');
  });

  it('marca timing demasiado uniforme', () => {
    const state = makeState([
      {
        userId: 'uniform_bot',
        answers: Array.from({ length: 10 }, () => ({ ms: 2500, ok: false })),
      },
    ]);
    const reports = ac.analyze(state);
    expect(reports[0]?.reasons).toContain('uniform_timing');
  });

  it('no marca jugadores con <5 respuestas', () => {
    const state = makeState([
      {
        userId: 'quitter',
        answers: [
          { ms: 300, ok: true },
          { ms: 300, ok: true },
          { ms: 300, ok: true },
        ],
      },
    ]);
    expect(ac.analyze(state)).toHaveLength(0);
  });
});
