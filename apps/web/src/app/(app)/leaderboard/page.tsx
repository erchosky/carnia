'use client';

import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, queryKeys } from '@/lib/content-api';
import { BackButton } from '@/components/back-button';
import { TierBadge } from '@/features/leaderboard/tier-badge';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';
import type { LeaderboardEntry } from '@carnia/contracts';

export default function LeaderboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.leaderboard(50),
    queryFn: () => leaderboardApi.top(50),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1 animate-slide-up">
        <BackButton />
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold">Clasificación</h1>
          {data?.totalPlayers ? (
            <span className="text-xs text-muted">
              {data.totalPlayers} jugadores
            </span>
          ) : null}
        </div>
        {data?.seasonName && (
          <p className="text-xs text-muted uppercase tracking-wider">
            {data.seasonName}
          </p>
        )}
      </header>

      {data?.me && !data.top.find((t) => t.userId === data.me?.userId) && (
        <section className="animate-slide-up">
          <p className="text-xs uppercase text-muted mb-2">Tu posición</p>
          <Row entry={data.me} highlight />
        </section>
      )}

      <section className="space-y-1.5">
        {isLoading && (
          <div className="card p-6 text-center text-muted text-sm">Cargando…</div>
        )}
        {error && (
          <div className="card p-6 text-center text-accent text-sm">
            Error: {(error as Error).message}
          </div>
        )}
        {data?.top.length === 0 && !isLoading && (
          <div className="card p-6 text-center text-muted text-sm">
            Aún no hay nadie clasificado. Sé el primero — juega una PvP.
          </div>
        )}
        {data?.top.map((entry) => (
          <Row
            key={entry.userId}
            entry={entry}
            highlight={entry.userId === user?.id}
          />
        ))}
      </section>
    </div>
  );
}

function Row({ entry, highlight }: { entry: LeaderboardEntry; highlight?: boolean }) {
  const rankLabel = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`;
  return (
    <div
      className={cn(
        'card p-3 flex items-center gap-3 transition-colors animate-slide-up',
        highlight && 'border-accent bg-accent/5',
      )}
    >
      <div className="w-10 text-center font-bold tabular-nums">{rankLabel}</div>
      <div className="w-9 h-9 rounded-full bg-bg-subtle flex items-center justify-center text-xs font-bold shrink-0">
        {entry.username.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate flex items-center gap-2">
          {entry.username}
          {highlight && <span className="text-xs text-accent">(TÚ)</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Nv. {entry.level}</span>
          <span>·</span>
          <span>
            <span className="text-win">{entry.wins}W</span> /{' '}
            <span className="text-muted">{entry.losses}L</span>
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black tabular-nums">{entry.elo}</div>
        <TierBadge tier={entry.tier} />
      </div>
    </div>
  );
}
