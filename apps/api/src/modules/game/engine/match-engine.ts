import {
  GAME,
  DEFAULT_ROOM_CONFIG,
  computeScore,
  type RevealPayload,
  type RoomConfig,
} from '@carnia/contracts';
import {
  type FullQuestion,
  type MatchOutcome,
  type MatchPlayer,
  type MatchRound,
  type MatchState,
  activeRound,
  allAnswered,
} from './match-state';

export class InvalidAnswerError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/**
 * Funciones puras que derivan un nuevo MatchState.
 * Sin I/O: testeables sin DB ni Redis. Devuelven el estado y los datos a emitir.
 */

export interface AnswerResult {
  state: MatchState;
  closedRound: boolean;
  eliminatedUserId?: string;
  perPlayerResult: {
    userId: string;
    isCorrect: boolean;
    scoreGained: number;
    answerMs: number;
  };
}

export type RoundReveal = Omit<RevealPayload, 'matchId' | 'nextRoundAt' | 'lives'>;

export interface CloseRoundResult {
  state: MatchState;
  reveal: RoundReveal;
}

export interface AdvanceResult {
  state: MatchState;
  /** Próxima ronda a emitir con match:question, si la hay. */
  nextRound: MatchRound | null;
  /** Resultado final si el match terminó. */
  ended: MatchOutcome | null;
}

export function initMatchState(opts: {
  matchId: string;
  roomId: string;
  mode: 'PVP_1V1' | 'RANKED';
  players: MatchPlayer[];
  questions: FullQuestion[];
  config?: RoomConfig;
  now?: number;
}): MatchState {
  const config = opts.config ?? DEFAULT_ROOM_CONFIG;
  const scores = Object.fromEntries(opts.players.map((p) => [p.userId, 0]));
  const lives =
    config.gameMode === 'SURVIVAL'
      ? Object.fromEntries(opts.players.map((p) => [p.userId, GAME.SURVIVAL_LIVES]))
      : null;

  return {
    matchId: opts.matchId,
    roomId: opts.roomId,
    mode: opts.mode,
    phase: 'COUNTDOWN',
    players: opts.players,
    scores,
    rounds: [],
    currentRoundIndex: -1,
    totalRounds: opts.questions.length,
    questionsQueue: [...opts.questions],
    startedAt: opts.now ?? Date.now(),
    finishedAt: null,
    config,
    lives,
  };
}

/** Avanza COUNTDOWN → QUESTION_0, o REVEAL_n → QUESTION_n+1 / FINISHED. */
export function startNextRound(state: MatchState, now: number): AdvanceResult {
  const nextIdx = state.currentRoundIndex + 1;
  if (nextIdx >= state.totalRounds) return finish(state, now);

  const question = state.questionsQueue[nextIdx];
  if (!question) throw new Error('question_missing');

  const round: MatchRound = {
    index: nextIdx,
    question,
    startedAt: now,
    durationMs: state.config.questionDurationMs,
    answers: {},
    closed: false,
  };

  return {
    state: {
      ...state,
      phase: 'QUESTION',
      rounds: [...state.rounds, round],
      currentRoundIndex: nextIdx,
    },
    nextRound: round,
    ended: null,
  };
}

/** Aplica la respuesta de un jugador. Lanza InvalidAnswerError si no es válida. */
export function submitAnswer(
  state: MatchState,
  input: { userId: string; roundIndex: number; optionId: string; serverNow: number },
): AnswerResult {
  if (state.phase !== 'QUESTION') throw new InvalidAnswerError('not_in_question_phase');
  if (input.roundIndex !== state.currentRoundIndex) throw new InvalidAnswerError('round_mismatch');

  const round = state.rounds[state.currentRoundIndex];
  if (!round) throw new InvalidAnswerError('round_not_found');
  if (round.closed) throw new InvalidAnswerError('round_closed');
  if (round.answers[input.userId]) throw new InvalidAnswerError('already_answered');
  if (!state.players.some((p) => p.userId === input.userId)) {
    throw new InvalidAnswerError('not_a_player');
  }
  if (!round.question.options.some((o) => o.id === input.optionId)) {
    throw new InvalidAnswerError('unknown_option');
  }

  const elapsed = input.serverNow - round.startedAt;
  if (elapsed < GAME.MIN_ANSWER_MS) throw new InvalidAnswerError('too_fast');
  if (elapsed > round.durationMs + GAME.ANSWER_GRACE_MS) throw new InvalidAnswerError('timeout');

  const correctOption = round.question.options.find((o) => o.isCorrect);
  if (!correctOption) throw new InvalidAnswerError('no_correct_option');

  const isCorrect = input.optionId === correctOption.id;
  const scoreGained = isCorrect ? computeScore(elapsed, round.durationMs) : 0;
  const answer = {
    optionId: input.optionId,
    answerMs: Math.min(elapsed, round.durationMs),
    isCorrect,
    scoreGained,
    submittedAt: input.serverNow,
  };

  const updatedRound: MatchRound = {
    ...round,
    answers: { ...round.answers, [input.userId]: answer },
  };
  const rounds = replaceRound(state.rounds, updatedRound);
  const scores = { ...state.scores, [input.userId]: (state.scores[input.userId] ?? 0) + scoreGained };

  // Supervivencia: un fallo cuesta una vida.
  let lives = state.lives;
  let eliminatedUserId: string | undefined;
  if (lives && !isCorrect) {
    const remaining = Math.max(0, (lives[input.userId] ?? 1) - 1);
    lives = { ...lives, [input.userId]: remaining };
    if (remaining === 0) eliminatedUserId = input.userId;
  }

  return {
    state: { ...state, rounds, scores, lives },
    closedRound: allAnswered(updatedRound, state.players.map((p) => p.userId)),
    eliminatedUserId,
    perPlayerResult: { userId: input.userId, isCorrect, scoreGained, answerMs: answer.answerMs },
  };
}

/**
 * Cierra la ronda activa (todos respondieron, timeout o eliminación).
 * Los jugadores sin respuesta quedan como "sin respuesta"; en SURVIVAL pierden
 * una vida salvo que `penalizeUnanswered` sea false (cierre anticipado por eliminación,
 * donde el rival no ha tenido tiempo de contestar).
 */
export function closeRound(
  state: MatchState,
  now: number,
  opts: { penalizeUnanswered?: boolean } = {},
): CloseRoundResult {
  const penalize = opts.penalizeUnanswered ?? true;
  const round = activeRound(state);
  if (!round) throw new Error('no_active_round');
  if (round.closed) throw new Error('round_already_closed');

  const answers = { ...round.answers };
  let lives = state.lives;
  for (const player of state.players) {
    if (answers[player.userId]) continue;
    answers[player.userId] = {
      optionId: null,
      answerMs: round.durationMs,
      isCorrect: false,
      scoreGained: 0,
      submittedAt: now,
    };
    if (lives && penalize) {
      lives = { ...lives, [player.userId]: Math.max(0, (lives[player.userId] ?? 1) - 1) };
    }
  }

  const closed: MatchRound = { ...round, answers, closed: true };
  const nextState: MatchState = {
    ...state,
    phase: 'REVEAL',
    rounds: replaceRound(state.rounds, closed),
    lives,
  };
  return { state: nextState, reveal: buildReveal(nextState, closed) };
}

/** Payload de revelación de una ronda ya cerrada. También se usa en el resync. */
export function buildReveal(state: MatchState, round: MatchRound): RoundReveal {
  const correctOption = round.question.options.find((o) => o.isCorrect);
  if (!correctOption) throw new Error(`question_no_correct_option:${round.question.id}`);

  return {
    roundIndex: round.index,
    correctOptionId: correctOption.id,
    explanation: round.question.explanation,
    answers: state.players.map((p) => {
      const a = round.answers[p.userId];
      return {
        userId: p.userId,
        optionId: a?.optionId ?? null,
        answerMs: a?.optionId ? a.answerMs : null,
        isCorrect: a?.isCorrect ?? false,
        scoreGained: a?.scoreGained ?? 0,
      };
    }),
    scores: { ...state.scores },
  };
}

/** Tras el reveal decide si hay otra ronda o si el match termina. */
export function advanceAfterReveal(state: MatchState, now: number): AdvanceResult {
  if (state.phase !== 'REVEAL') throw new Error('not_in_reveal');
  if (hasEliminatedPlayer(state)) return finish(state, now);
  return startNextRound(state, now);
}

export function hasEliminatedPlayer(state: MatchState): boolean {
  return state.lives !== null && Object.values(state.lives).some((l) => l <= 0);
}

/**
 * Decide el ganador. En SURVIVAL gana quien conserve más vidas;
 * si empatan en vidas (o no es SURVIVAL), decide la puntuación.
 */
export function decideOutcome(state: MatchState): MatchOutcome {
  const lives = state.lives;
  const ranked = [...state.players].sort((a, b) => {
    if (lives) {
      const byLives = (lives[b.userId] ?? 0) - (lives[a.userId] ?? 0);
      if (byLives !== 0) return byLives;
    }
    return (state.scores[b.userId] ?? 0) - (state.scores[a.userId] ?? 0);
  });
  const [top, second] = ranked;
  if (!top) return { winnerId: null, draw: true };
  const draw =
    !!second &&
    (state.scores[top.userId] ?? 0) === (state.scores[second.userId] ?? 0) &&
    (lives?.[top.userId] ?? 0) === (lives?.[second.userId] ?? 0);
  return { winnerId: draw ? null : top.userId, draw };
}

function finish(state: MatchState, now: number): AdvanceResult {
  return {
    state: { ...state, phase: 'FINISHED', finishedAt: now },
    nextRound: null,
    ended: decideOutcome(state),
  };
}

function replaceRound(rounds: MatchRound[], round: MatchRound): MatchRound[] {
  const copy = [...rounds];
  copy[round.index] = round;
  return copy;
}
