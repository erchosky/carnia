'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { ServerToClientEvents } from '@carnia/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { currentSocket, getSocket, subscribeToSocket, type AppSocket } from '@/lib/socket';
import { refreshAccessToken } from '@/lib/api';
import { usePvpStore } from './pvp-store';

/**
 * Mantiene la conexión Socket.IO y conecta los eventos realtime con `usePvpStore`.
 *
 * Los listeners se quitan con su referencia (`socket.off(event, handler)`), no con
 * `socket.off(event)`, que borraría también los de la pantalla siguiente durante
 * una transición de ruta o el doble montaje de StrictMode.
 */
export function usePvpSocket(): AppSocket | null {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  // El socket es un singleton de módulo: se lee como store externo en vez de copiarlo a estado.
  const socket = useSyncExternalStore(subscribeToSocket, currentSocket, () => null);

  useEffect(() => {
    if (!accessToken) return;
    const { setStatus, setError } = useSocketStore.getState();
    const store = usePvpStore.getState;
    const s = getSocket(accessToken);
    setStatus(s.connected ? 'connected' : 'connecting');

    const onConnect = () => {
      setStatus('connected');
      setError(null);
    };
    const onDisconnect = () => setStatus('disconnected');
    // Token caducado: se renueva y se reintenta en lugar de reconectar en bucle.
    const onConnectError = async (err: Error) => {
      if (err.message !== 'unauthorized') {
        setStatus('error');
        setError(err.message);
        return;
      }
      try {
        const tokens = await refreshAccessToken();
        s.auth = { token: tokens.accessToken };
        s.connect();
      } catch {
        setStatus('error');
        setError('Sesión expirada — vuelve a iniciar sesión');
      }
    };

    const handlers: { [K in keyof ServerToClientEvents]?: ServerToClientEvents[K] } = {
      'room:state': (p) => store().setRoom(p),
      'room:member_join': (p) => store().patchRoomMember(p),
      'room:member_leave': (p) => store().removeRoomMember(p.userId),
      'room:ready_update': (p) => store().setReady(p.userId, p.ready),
      'match:countdown': (p) => {
        setError(null);
        store().setCountdown(p.secondsLeft);
      },
      'match:start': (p) => store().setMatchStart(p),
      'match:question': (p) => store().setQuestion(p),
      'match:opponent_answered': (p) => store().markOpponentAnswered(p.userId),
      'match:reveal': (p) => store().setReveal(p),
      'match:end': (p) => store().setMatchEnd(p),
      'match:state': (p) => store().syncMatchState(p),
      'match:rematch_request': (p) => store().addRematchRequest(p.userId),
      error: (p) => setError(p.message),
    };
    const events = Object.entries(handlers) as Array<[keyof ServerToClientEvents, never]>;

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    for (const [event, handler] of events) s.on(event, handler);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      for (const [event, handler] of events) s.off(event, handler);
    };
  }, [accessToken]);

  return accessToken ? socket : null;
}
