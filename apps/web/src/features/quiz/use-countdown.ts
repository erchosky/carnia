import { useEffect, useEffectEvent, useState } from 'react';

const TICK_MS = 100;

/**
 * Cuenta atrás de una pregunta. `startedAt` está en el reloj LOCAL
 * (ver `localStartFromServer`), así el desfase de reloj con el servidor no afecta.
 */
export function useCountdown(
  startedAt: number,
  durationMs: number,
  enabled: boolean,
  onTimeout?: () => void,
): { remainingMs: number; progress: number } {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  // Siempre llama a la versión más reciente de onTimeout sin reiniciar el temporizador.
  const fireTimeout = useEffectEvent(() => onTimeout?.());

  useEffect(() => {
    if (!enabled) return;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, durationMs - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left === 0 && !fired) {
        fired = true;
        clearInterval(handle);
        fireTimeout();
      }
    };
    const handle = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(handle);
  }, [enabled, startedAt, durationMs]);

  return { remainingMs, progress: durationMs > 0 ? remainingMs / durationMs : 0 };
}

/**
 * Convierte el inicio de ronda del servidor al reloj local.
 * `serverNow` es la hora del servidor cuando envió el dato; si no se conoce,
 * se asume que el dato acaba de llegar (latencia despreciable).
 */
export function localStartFromServer(serverStartedAt: number, serverNow = serverStartedAt): number {
  return Date.now() - Math.max(0, serverNow - serverStartedAt);
}
