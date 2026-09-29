'use client';

import { useEffect, useState } from 'react';
import type { MatchEndPayload } from '@carnia/contracts';
import { cn } from '@/lib/cn';
import { useAlmagroPhrase } from '@/lib/almagro';

interface Props {
  result: MatchEndPayload;
  players: Array<{ userId: string; username: string; level: number }>;
  meUserId: string;
  totalRounds: number;
  rematchRequestsFrom: string[];
  onRematch: (accept: boolean) => void;
  onLeave: () => void;
}

export function PvpResult({
  result,
  players,
  meUserId,
  totalRounds,
  rematchRequestsFrom,
  onRematch,
  onLeave,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((result.rematchDeadline - Date.now()) / 1000)),
  );
  const [myAnswer, setMyAnswer] = useState<'pending' | 'accepted' | 'declined'>('pending');

  useEffect(() => {
    const handle = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((result.rematchDeadline - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(handle);
  }, [result.rematchDeadline]);

  const won = result.winnerId === meUserId;
  const draw = result.draw;

  let title = 'Empate';
  let emoji = '🤝';
  if (!draw) {
    if (won) {
      title = '¡Victoria!';
      emoji = '🏆';
    } else {
      title = 'Derrota';
      emoji = '💀';
    }
  }

  const myCorrectCount = result.correctCounts[meUserId] ?? 0;
  const almagroMood = draw
    ? 'draw'
    : won
      ? myCorrectCount === totalRounds
        ? 'perfect'
        : 'win'
      : 'lose';
  const almagroPhrase = useAlmagroPhrase(almagroMood, result.matchId);

  const opponentRequestedRematch =
    rematchRequestsFrom.some((id) => id !== meUserId);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-6 animate-pop-in">
      <div className="space-y-2">
        <div className="text-7xl">{emoji}</div>
        <h1 className={cn('text-3xl font-black', won && 'text-win', !won && !draw && 'text-lose')}>
          {title}
        </h1>
        <p className="text-sm text-muted italic">🚗 {almagroPhrase}</p>
      </div>

      <div className="card p-5 w-full space-y-3">
        {players.map((p) => {
          const isMe = p.userId === meUserId;
          const score = result.scores[p.userId] ?? 0;
          const correct = result.correctCounts[p.userId] ?? 0;
          const xp = result.xpEarned[p.userId] ?? 0;
          const isWinner = result.winnerId === p.userId;
          const eloDelta = result.eloDelta[p.userId];
          const newElo = result.newElo[p.userId];
          return (
            <div
              key={p.userId}
              className={cn(
                'flex items-center justify-between p-3 rounded-xl',
                isMe && 'bg-bg-subtle',
              )}
            >
              <div className="flex items-center gap-3">
                {isWinner && <span className="text-lg">👑</span>}
                <div className="text-left">
                  <div className="font-semibold">
                    {isMe ? 'Tú' : p.username}
                  </div>
                  <div className="text-xs text-muted">
                    {correct}/{totalRounds} · +{xp} XP
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{score}</div>
                {typeof newElo === 'number' && typeof eloDelta === 'number' && (
                  <div className="text-xs tabular-nums">
                    <span className="text-muted">{newElo} ELO </span>
                    <span
                      className={
                        eloDelta > 0
                          ? 'text-win font-bold'
                          : eloDelta < 0
                            ? 'text-lose font-bold'
                            : 'text-muted'
                      }
                    >
                      {eloDelta > 0 ? `+${eloDelta}` : eloDelta}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {myAnswer === 'pending' && secondsLeft > 0 && (
        <div className="space-y-2 w-full">
          <p className="text-sm text-muted">
            ¿Revancha? <span className="text-accent">{secondsLeft}s</span>
          </p>
          {opponentRequestedRematch && (
            <p className="text-xs text-win animate-pulse">
              ¡Tu rival quiere revancha!
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setMyAnswer('declined');
                onRematch(false);
                onLeave();
              }}
            >
              No, gracias
            </button>
            <button
              className="btn-primary animate-pulse-glow"
              onClick={() => {
                setMyAnswer('accepted');
                onRematch(true);
              }}
            >
              ¡Revancha!
            </button>
          </div>
        </div>
      )}

      {myAnswer === 'accepted' && (
        <div className="space-y-2 w-full">
          <p className="text-sm text-muted text-center">
            Esperando confirmación del rival…
          </p>
          <button className="btn-ghost w-full" onClick={onLeave}>
            Cancelar y salir
          </button>
        </div>
      )}

      {(myAnswer === 'declined' || secondsLeft <= 0) && (
        <button className="btn-secondary w-full" onClick={onLeave}>
          Volver al lobby
        </button>
      )}
    </div>
  );
}
