import { describe, expect, it } from 'vitest';
import { computeStreak, previousUtcDay, seededShuffle } from '../daily-utils';

describe('previousUtcDay', () => {
  it('cruza meses y años', () => {
    expect(previousUtcDay('2026-03-01')).toBe('2026-02-28');
    expect(previousUtcDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('computeStreak', () => {
  it('cuenta días consecutivos terminando hoy', () => {
    expect(computeStreak(['2026-09-28', '2026-09-27', '2026-09-26'], '2026-09-28')).toBe(3);
  });
  it('mantiene la racha si hoy aún no se ha jugado', () => {
    expect(computeStreak(['2026-09-27', '2026-09-26'], '2026-09-28')).toBe(2);
  });
  it('se rompe con un día sin jugar', () => {
    expect(computeStreak(['2026-09-28', '2026-09-26'], '2026-09-28')).toBe(1);
    expect(computeStreak(['2026-09-26'], '2026-09-28')).toBe(0);
  });
  it('es 0 sin entradas', () => {
    expect(computeStreak([], '2026-09-28')).toBe(0);
  });
});

describe('seededShuffle', () => {
  const items = Array.from({ length: 50 }, (_, i) => `q${i}`);
  it('es determinista para la misma semilla', () => {
    expect(seededShuffle(items, '2026-09-28')).toEqual(seededShuffle(items, '2026-09-28'));
  });
  it('cambia con la semilla y conserva los elementos', () => {
    const a = seededShuffle(items, '2026-09-28');
    expect(a).not.toEqual(seededShuffle(items, '2026-09-29'));
    expect([...a].sort()).toEqual([...items].sort());
  });
});
