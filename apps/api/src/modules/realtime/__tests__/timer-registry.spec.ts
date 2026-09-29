import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerRegistry } from '../orchestrator/timer-registry';

describe('TimerRegistry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ejecuta el timeout y lo olvida', () => {
    const timers = new TimerRegistry();
    const fn = vi.fn();
    timers.timeout('question:m1', 1000, fn);
    expect(timers.size).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledOnce();
    expect(timers.size).toBe(0);
  });

  it('reprogramar una clave cancela el timer anterior', () => {
    const timers = new TimerRegistry();
    const first = vi.fn();
    const second = vi.fn();
    timers.timeout('reveal:m1', 1000, first);
    timers.timeout('reveal:m1', 1000, second);
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('clear solo afecta a la clave exacta', () => {
    const timers = new TimerRegistry();
    const a = vi.fn();
    const b = vi.fn();
    timers.timeout('question:m1', 1000, a);
    timers.timeout('question:m10', 1000, b);
    timers.clear('question:m1');
    vi.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('clearAll detiene intervalos y timeouts', () => {
    const timers = new TimerRegistry();
    const tick = vi.fn();
    timers.interval('countdown:r1', 100, tick);
    timers.timeout('cleanup:m1', 100, tick);
    timers.clearAll();
    vi.advanceTimersByTime(1000);
    expect(tick).not.toHaveBeenCalled();
  });
});
