export const GAME = {
  QUESTIONS_PER_MATCH: 10,
  DAILY_QUESTION_COUNT: 10,
  DAILY_POINTS_PER_CORRECT: 100,
  QUESTION_DURATION_MS: 15_000,
  /** Margen de red aceptado tras el fin del temporizador. */
  ANSWER_GRACE_MS: 500,
  REVEAL_DURATION_MS: 3_000,
  BLITZ_REVEAL_DURATION_MS: 800,
  COUNTDOWN_DURATION_MS: 3_000,
  MIN_ANSWER_MS: 200,
  /** Respuestas por debajo de este tiempo cuentan para el logro "Rayo". */
  FAST_ANSWER_MS: 3_000,
  RECONNECT_GRACE_MS: 30_000,
  REMATCH_TIMEOUT_MS: 30_000,
  BASE_SCORE: 500,
  ROOM_CODE_LENGTH: 6,
  SURVIVAL_LIVES: 3,
  DEFAULT_ELO: 1000,
} as const;

export const XP = {
  PER_CORRECT_ANSWER: 10,
  PER_MATCH_PLAYED: 25,
  WIN_BONUS: 50,
  PERFECT_BONUS: 100,
  LEVEL_BASE: 100,
  LEVEL_EXPONENT: 1.5,
} as const;

export function xpForLevel(level: number): number {
  return Math.floor(XP.LEVEL_BASE * Math.pow(level, XP.LEVEL_EXPONENT));
}

/** XP acumulada necesaria para alcanzar `level` desde el nivel 1. */
export function totalXpForLevel(level: number): number {
  let acc = 0;
  for (let i = 1; i < level; i++) acc += xpForLevel(i);
  return acc;
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  let acc = 0;
  while (level < 999) {
    const need = xpForLevel(level);
    if (acc + need > totalXp) return level;
    acc += need;
    level++;
  }
  return 999;
}

/**
 * Puntuación de una respuesta correcta: BASE_SCORE más un bonus lineal por velocidad.
 * 2×BASE si se responde al instante, BASE si se agota el tiempo.
 */
export function computeScore(elapsedMs: number, durationMs: number = GAME.QUESTION_DURATION_MS): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= durationMs) return GAME.BASE_SCORE;
  const ratio = 1 - elapsedMs / durationMs;
  return Math.round(GAME.BASE_SCORE + ratio * GAME.BASE_SCORE);
}

export function matchXp(opts: {
  correctCount: number;
  totalRounds: number;
  isWinner: boolean;
}): number {
  return (
    XP.PER_MATCH_PLAYED +
    opts.correctCount * XP.PER_CORRECT_ANSWER +
    (opts.isWinner ? XP.WIN_BONUS : 0) +
    (opts.totalRounds > 0 && opts.correctCount === opts.totalRounds ? XP.PERFECT_BONUS : 0)
  );
}
