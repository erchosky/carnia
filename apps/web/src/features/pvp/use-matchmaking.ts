'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppSocket } from '@/lib/socket';
import { usePvpStore } from './pvp-store';

export type QueueStatus = 'idle' | 'searching' | 'matched';

/** Cola de emparejamiento aleatorio ("Partida rápida"). */
export function useMatchmaking(socket: AppSocket | null) {
  const router = useRouter();
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [position, setPosition] = useState<number | null>(null);
  // Estado más reciente para la limpieza del efecto (sin volver a suscribir en cada cambio).
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!socket) return;
    const onPosition = ({ position }: { position: number }) => {
      setPosition(position);
      setStatus('searching');
    };
    // room:state llega antes que queue:matched, así que el store ya tiene el código.
    const onMatched = ({ roomId }: { roomId: string }) => {
      setStatus('matched');
      router.push(`/pvp/room/${usePvpStore.getState().room?.code ?? roomId}`);
    };
    socket.on('queue:position', onPosition);
    socket.on('queue:matched', onMatched);
    return () => {
      socket.off('queue:position', onPosition);
      socket.off('queue:matched', onMatched);
      // Salir de la pantalla mientras se busca abandona la cola.
      if (statusRef.current === 'searching') socket.emit('queue:leave');
    };
  }, [socket, router]);

  return {
    status,
    position,
    join: () => {
      if (!socket || status !== 'idle') return;
      usePvpStore.getState().reset();
      socket.emit('queue:join', { mode: 'STANDARD' });
      setStatus('searching');
      setPosition(null);
    },
    leave: () => {
      socket?.emit('queue:leave');
      setStatus('idle');
      setPosition(null);
    },
  };
}
