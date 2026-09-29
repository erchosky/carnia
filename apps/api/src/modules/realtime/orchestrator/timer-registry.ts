/**
 * Timers con nombre para el orquestador. Centraliza la limpieza para que
 * ningún callback se dispare sobre una sala o match ya destruidos.
 *
 * Claves usadas: `countdown:<roomId>`, `abandon:<roomId>`,
 * `question:<matchId>`, `reveal:<matchId>`, `cleanup:<matchId>`.
 */
export class TimerRegistry {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  get size(): number {
    return this.timers.size;
  }

  timeout(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, ms),
    );
  }

  interval(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    this.timers.set(key, setInterval(fn, ms));
  }

  clear(key: string): void {
    const handle = this.timers.get(key);
    if (!handle) return;
    clearTimeout(handle);
    clearInterval(handle);
    this.timers.delete(key);
  }

  clearAll(): void {
    for (const key of [...this.timers.keys()]) this.clear(key);
  }
}
