'use client';

import { GAME } from '@carnia/contracts';
import { cn } from '@/lib/cn';

interface Props {
  players: Array<{ userId: string; username: string; avatarUrl: string | null; level: number }>;
  scores: Record<string, number>;
  meUserId: string;
  opponentAnswered: Record<string, boolean>;
  /** Solo en SURVIVAL. */
  lives: Record<string, number> | null;
}

export function ScoreBoard({ players, scores, meUserId, opponentAnswered, lives }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => {
        const isMe = p.userId === meUserId;
        const score = scores[p.userId] ?? 0;
        const answered = opponentAnswered[p.userId];
        const playerLives = lives?.[p.userId] ?? null;
        return (
          <div
            key={p.userId}
            className={cn(
              'card p-3 flex items-center justify-between transition-all',
              isMe && 'border-accent',
              answered && !isMe && 'border-win',
            )}
          >
            <div>
              <div className="text-xs text-muted">{isMe ? 'TÚ' : p.username.toUpperCase()}</div>
              <div className="text-2xl font-black tabular-nums">{score}</div>
              {playerLives !== null && (
                <div className="flex gap-0.5 mt-1" aria-label={`${playerLives} vidas`}>
                  {Array.from({ length: GAME.SURVIVAL_LIVES }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-xs transition-all',
                        i < playerLives ? 'opacity-100' : 'opacity-20 grayscale',
                      )}
                    >
                      ❤️
                    </span>
                  ))}
                </div>
              )}
            </div>
            {playerLives === 0 ? (
              <span className="text-xs text-lose font-bold">ELIMINADO</span>
            ) : (
              answered &&
              !isMe && <span className="text-xs text-win font-bold animate-pop-in">✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
