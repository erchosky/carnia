'use client';

import { useQuery } from '@tanstack/react-query';
import type { AchievementStatus } from '@carnia/contracts';
import { achievementsApi, queryKeys } from '@/lib/content-api';
import { BackButton } from '@/components/back-button';
import { cn } from '@/lib/cn';

export default function AchievementsPage() {
  const { data: achievements, isLoading } = useQuery({
    queryKey: queryKeys.achievements,
    queryFn: achievementsApi.all,
  });

  const earned = achievements?.filter((a) => a.earned) ?? [];
  const locked = achievements?.filter((a) => !a.earned) ?? [];

  return (
    <div className="space-y-6">
      <header className="animate-slide-up space-y-1">
        <BackButton />
        <h1 className="text-2xl font-bold">Logros</h1>
        <p className="text-sm text-muted">
          {earned.length} / {achievements?.length ?? 0} conseguidos
        </p>
      </header>

      {isLoading && (
        <div className="text-center text-muted py-12">Cargando logros…</div>
      )}

      {earned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Conseguidos ({earned.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {earned.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </div>
        </section>
      )}

      {locked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Por conseguir ({locked.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {locked.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AchievementCard({ achievement: a }: { achievement: AchievementStatus }) {
  return (
    <div
      className={cn(
        'card p-4 space-y-2 transition-all',
        !a.earned && 'opacity-40 grayscale',
        a.earned && 'border-yellow-500/30',
      )}
    >
      <div className="text-3xl">{a.icon}</div>
      <div>
        <div className="font-bold text-sm">{a.name}</div>
        <div className="text-xs text-muted leading-snug mt-0.5">{a.description}</div>
      </div>
      {a.earned && a.earnedAt && (
        <div className="text-xs text-yellow-500/70">
          {new Date(a.earnedAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      )}
      {!a.earned && (
        <div className="text-xs text-muted">Bloqueado</div>
      )}
    </div>
  );
}
