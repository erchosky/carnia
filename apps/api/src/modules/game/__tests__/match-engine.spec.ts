import { describe, expect, it } from 'vitest';
import {
  InvalidAnswerError,
  advanceAfterReveal,
  closeRound,
  decideOutcome,
  initMatchState,
  startNextRound,
  submitAnswer,
} from '../engine/match-engine';
import { computeScore } from '@carnia/contracts';
import type { Question, QuestionOption } from '@carnia/db';

function makeQuestion(id: string, correctIndex = 0): Question & { options: QuestionOption[] } {
  return {
    id,
    prompt: `Q-${id}`,
    explanation: 'porque sí',
    imageUrl: null,
    category: 'SIGNALS',
    difficulty: 1,
    isTrap: false,
    source: null,
    tags: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: Array.from({ length: 4 }).map((_, i) => ({
      id: `${id}-opt-${i}`,
      questionId: id,
      text: `opt-${i}`,
      isCorrect: i === correctIndex,
      position: i,
    })),
  };
}

const players = [
  { userId: 'u1', username: 'a', avatarUrl: null, level: 1, connected: true, disconnectedAt: null },
  { userId: 'u2', username: 'b', avatarUrl: null, level: 1, connected: true, disconnectedAt: null },
];

describe('computeScore', () => {
  it('da puntuación máxima en tiempo 0', () => {
    expect(computeScore(0, 15000)).toBe(1000);
  });
  it('da BASE_SCORE en timeout', () => {
    expect(computeScore(15000, 15000)).toBe(500);
  });
  it('escala linealmente', () => {
    expect(computeScore(7500, 15000)).toBe(750);
  });
});

describe('match engine', () => {
  it('inicia y avanza por rondas correctamente', () => {
    let state = initMatchState({
      matchId: 'm1',
      roomId: 'r1',
      mode: 'PVP_1V1',
      players,
      questions: [makeQuestion('q1'), makeQuestion('q2')],
    });
    expect(state.phase).toBe('COUNTDOWN');

    const { state: s2 } = startNextRound(state, 1000);
    state = s2;
    expect(state.phase).toBe('QUESTION');
    expect(state.currentRoundIndex).toBe(0);
  });

  it('rechaza respuestas demasiado rápidas', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;

    expect(() =>
      submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 1050 }),
    ).toThrow(InvalidAnswerError);
  });

  it('rechaza respuestas en timeout', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;

    expect(() =>
      submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 1000 + 16000 }),
    ).toThrow(InvalidAnswerError);
  });

  it('rechaza segunda respuesta del mismo jugador', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;
    state = submitAnswer(state, {
      userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 2000,
    }).state;

    expect(() =>
      submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'q1-opt-1', serverNow: 3000 }),
    ).toThrow(InvalidAnswerError);
  });

  it('cierra la ronda cuando ambos responden', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;

    const a1 = submitAnswer(state, {
      userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 2000,
    });
    expect(a1.closedRound).toBe(false);

    const a2 = submitAnswer(a1.state, {
      userId: 'u2', roundIndex: 0, optionId: 'q1-opt-1', serverNow: 3000,
    });
    expect(a2.closedRound).toBe(true);
  });

  it('asigna scoring correcto: solo el que acierta', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1', 0)],
    });
    state = startNextRound(state, 1000).state;

    state = submitAnswer(state, {
      userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 2000,
    }).state;
    state = submitAnswer(state, {
      userId: 'u2', roundIndex: 0, optionId: 'q1-opt-1', serverNow: 2500,
    }).state;

    expect(state.scores.u1).toBeGreaterThan(0);
    expect(state.scores.u2).toBe(0);
  });

  it('cierra ronda con respuestas vacías al timeout', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;

    const { reveal } = closeRound(state, 1000 + 16000);
    expect(reveal.answers).toHaveLength(2);
    expect(reveal.answers.every((a) => a.optionId === null)).toBe(true);
  });

  it('finaliza correctamente y determina ganador', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;
    state = submitAnswer(state, {
      userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 2000,
    }).state;
    state = submitAnswer(state, {
      userId: 'u2', roundIndex: 0, optionId: 'q1-opt-1', serverNow: 2500,
    }).state;
    state = closeRound(state, 3000).state;
    const adv = advanceAfterReveal(state, 4000);

    expect(adv.ended).not.toBeNull();
    expect(adv.ended!.winnerId).toBe('u1');
    expect(adv.ended!.draw).toBe(false);
  });
});

describe('match engine — validaciones', () => {
  it('rechaza opciones que no pertenecen a la pregunta', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;
    expect(() =>
      submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'otra-pregunta-opt', serverNow: 2000 }),
    ).toThrow(InvalidAnswerError);
  });

  it('usa la duración configurada en la sala', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
      config: { questionDurationMs: 5000, totalRounds: 5, categories: null, gameMode: 'PVP_1V1' },
    });
    state = startNextRound(state, 1000).state;
    expect(state.rounds[0]!.durationMs).toBe(5000);
    expect(() =>
      submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'q1-opt-0', serverNow: 1000 + 6000 }),
    ).toThrow(InvalidAnswerError);
  });

  it('declara empate con puntuaciones iguales', () => {
    let state = initMatchState({
      matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players,
      questions: [makeQuestion('q1')],
    });
    state = startNextRound(state, 1000).state;
    state = closeRound(state, 17000).state;
    const adv = advanceAfterReveal(state, 18000);
    expect(adv.ended).toEqual({ winnerId: null, draw: true });
  });
});

describe('match engine — supervivencia', () => {
  const survival = { questionDurationMs: 15000, totalRounds: 5, categories: null, gameMode: 'SURVIVAL' } as const;
  const questions = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => makeQuestion(id));

  it('empieza con 3 vidas y resta una por fallo', () => {
    let state = initMatchState({ matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players, questions, config: survival });
    expect(state.lives).toEqual({ u1: 3, u2: 3 });
    state = startNextRound(state, 1000).state;
    state = submitAnswer(state, { userId: 'u1', roundIndex: 0, optionId: 'q1-opt-1', serverNow: 2000 }).state;
    expect(state.lives!.u1).toBe(2);
  });

  it('el timeout cuesta una vida, pero no en un cierre anticipado por eliminación', () => {
    let state = initMatchState({ matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players, questions, config: survival });
    state = startNextRound(state, 1000).state;
    expect(closeRound(state, 17000).state.lives).toEqual({ u1: 2, u2: 2 });
    expect(closeRound(state, 17000, { penalizeUnanswered: false }).state.lives).toEqual({ u1: 3, u2: 3 });
  });

  it('termina el match cuando un jugador se queda sin vidas y gana el otro', () => {
    let state = initMatchState({ matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players, questions, config: survival });
    let eliminated: string | undefined;
    for (let round = 0; round < 3; round++) {
      state = round === 0 ? startNextRound(state, 1000).state : advanceAfterReveal(state, 1000 + round * 20000).state;
      const now = state.rounds[round]!.startedAt + 1000;
      state = submitAnswer(state, { userId: 'u2', roundIndex: round, optionId: `q${round + 1}-opt-0`, serverNow: now }).state;
      const res = submitAnswer(state, { userId: 'u1', roundIndex: round, optionId: `q${round + 1}-opt-1`, serverNow: now + 100 });
      state = res.state;
      eliminated = res.eliminatedUserId;
      state = closeRound(state, now + 200).state;
    }
    expect(eliminated).toBe('u1');
    const adv = advanceAfterReveal(state, 90000);
    expect(adv.nextRound).toBeNull();
    expect(adv.ended).toEqual({ winnerId: 'u2', draw: false });
  });

  it('un jugador sin vidas pierde aunque tenga más puntos', () => {
    let state = initMatchState({ matchId: 'm1', roomId: 'r1', mode: 'PVP_1V1', players, questions, config: survival });
    state = { ...state, scores: { u1: 5000, u2: 100 }, lives: { u1: 0, u2: 1 } };
    expect(decideOutcome(state)).toEqual({ winnerId: 'u2', draw: false });
  });
});
