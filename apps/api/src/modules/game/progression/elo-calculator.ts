/**
 * ELO 1v1 — implementación standard.
 *
 * - Expected score: 1 / (1 + 10^((Rb - Ra) / 400))
 * - New rating: Ra' = Ra + K * (Sa - Ea)  donde Sa = 1 (win) / 0.5 (draw) / 0 (loss)
 * - K-factor: 40 si <30 partidas (placement), 24 si <2000 ELO, 16 si ≥2000 (alto nivel).
 *
 * Pura — testeable sin DB.
 */

export type Outcome = 'win' | 'loss' | 'draw';

export interface EloInput {
  playerElo: number;
  opponentElo: number;
  outcome: Outcome;
  playerGamesPlayed: number;
}

export interface EloOutput {
  newElo: number;
  delta: number;
  kFactor: number;
}

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function kFactor(elo: number, gamesPlayed: number): number {
  if (gamesPlayed < 30) return 40;
  if (elo >= 2000) return 16;
  return 24;
}

export function computeElo(input: EloInput): EloOutput {
  const expected = expectedScore(input.playerElo, input.opponentElo);
  const actual = input.outcome === 'win' ? 1 : input.outcome === 'draw' ? 0.5 : 0;
  const k = kFactor(input.playerElo, input.playerGamesPlayed);
  const rawDelta = k * (actual - expected);
  const delta = Math.round(rawDelta);
  // ELO no puede bajar de 100 ni subir indefinidamente (caps razonables).
  const newElo = Math.max(100, Math.min(3000, input.playerElo + delta));
  return { newElo, delta: newElo - input.playerElo, kFactor: k };
}

/** Calcula los deltas de ambos jugadores en un 1v1. */
export function compute1v1(opts: {
  playerA: { elo: number; gamesPlayed: number };
  playerB: { elo: number; gamesPlayed: number };
  /** 'A' | 'B' | 'draw' */
  result: 'A' | 'B' | 'draw';
}): { a: EloOutput; b: EloOutput } {
  const outcomeA: Outcome = opts.result === 'draw' ? 'draw' : opts.result === 'A' ? 'win' : 'loss';
  const outcomeB: Outcome = opts.result === 'draw' ? 'draw' : opts.result === 'B' ? 'win' : 'loss';

  return {
    a: computeElo({
      playerElo: opts.playerA.elo,
      opponentElo: opts.playerB.elo,
      outcome: outcomeA,
      playerGamesPlayed: opts.playerA.gamesPlayed,
    }),
    b: computeElo({
      playerElo: opts.playerB.elo,
      opponentElo: opts.playerA.elo,
      outcome: outcomeB,
      playerGamesPlayed: opts.playerB.gamesPlayed,
    }),
  };
}
