/** Fecha UTC en formato AAAA-MM-DD. El reto diario cambia a medianoche UTC. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function previousUtcDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDay(d);
}

/**
 * Días consecutivos completados. Si hoy aún no se ha jugado, la racha
 * sigue viva desde ayer (no se "rompe" hasta que termina el día).
 */
export function computeStreak(completedDays: Iterable<string>, today: string): number {
  const days = new Set(completedDays);
  let cursor = days.has(today) ? today : previousUtcDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousUtcDay(cursor);
  }
  return streak;
}

/** Barajado determinista a partir de una semilla (misma fecha → mismo reto). */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
