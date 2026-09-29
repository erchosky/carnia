import { describe, expect, it } from 'vitest';
import {
  compute1v1,
  computeElo,
  expectedScore,
  kFactor,
} from '../progression/elo-calculator';

describe('expectedScore', () => {
  it('da 0.5 a iguales', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 3);
  });
  it('da >0.5 al de mayor ELO', () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.5);
  });
  it('400 puntos de diferencia ≈ 10x más probable', () => {
    // P(A gana) / P(B gana) ≈ 10 cuando diff = 400
    const ea = expectedScore(1400, 1000);
    const eb = expectedScore(1000, 1400);
    expect(ea / eb).toBeCloseTo(10, 0);
  });
});

describe('kFactor', () => {
  it('40 en placement (<30 partidas)', () => {
    expect(kFactor(1000, 5)).toBe(40);
  });
  it('24 nivel medio', () => {
    expect(kFactor(1500, 50)).toBe(24);
  });
  it('16 alto nivel', () => {
    expect(kFactor(2100, 100)).toBe(16);
  });
});

describe('computeElo', () => {
  it('ganar a un rival más fuerte da ganancia grande', () => {
    const r = computeElo({
      playerElo: 1000,
      opponentElo: 1400,
      outcome: 'win',
      playerGamesPlayed: 100,
    });
    expect(r.delta).toBeGreaterThan(15);
  });

  it('perder contra un rival más débil castiga fuerte', () => {
    const r = computeElo({
      playerElo: 1400,
      opponentElo: 1000,
      outcome: 'loss',
      playerGamesPlayed: 100,
    });
    expect(r.delta).toBeLessThan(-15);
  });

  it('empate entre iguales mueve 0', () => {
    const r = computeElo({
      playerElo: 1000,
      opponentElo: 1000,
      outcome: 'draw',
      playerGamesPlayed: 100,
    });
    expect(r.delta).toBe(0);
  });

  it('cap inferior en 100', () => {
    const r = computeElo({
      playerElo: 110,
      opponentElo: 2500,
      outcome: 'loss',
      playerGamesPlayed: 100,
    });
    expect(r.newElo).toBeGreaterThanOrEqual(100);
  });
});

describe('compute1v1', () => {
  it('suma cero entre ambos en partidas balanceadas (sin draw)', () => {
    const { a, b } = compute1v1({
      playerA: { elo: 1200, gamesPlayed: 50 },
      playerB: { elo: 1200, gamesPlayed: 50 },
      result: 'A',
    });
    // En ELO clásico, los deltas son opuestos
    expect(a.delta + b.delta).toBe(0);
  });

  it('placement vs veterano: el novato gana o pierde más', () => {
    const { a } = compute1v1({
      playerA: { elo: 1000, gamesPlayed: 5 },
      playerB: { elo: 1000, gamesPlayed: 200 },
      result: 'A',
    });
    expect(a.kFactor).toBe(40);
  });
});
