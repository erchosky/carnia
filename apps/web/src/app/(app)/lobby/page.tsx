'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GAME, QuestionCategorySchema, tierForElo } from '@carnia/contracts';
import { usersApi } from '@/lib/users-api';
import { dailyApi, queryKeys } from '@/lib/content-api';
import { useAuthStore } from '@/stores/auth-store';
import { TierBadge } from '@/features/leaderboard/tier-badge';
import { cn } from '@/lib/cn';

export default function LobbyPage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useQuery({
    queryKey: queryKeys.meStats,
    queryFn: usersApi.stats,
  });
  const { data: dailyStatus } = useQuery({
    queryKey: queryKeys.dailyStatus,
    queryFn: dailyApi.status,
    enabled: !!user,
  });

  const xpProgress = stats ? Math.min(100, stats.progress * 100) : 0;

  return (
    <div className="space-y-5 pb-6">

      {/* ── Header con perfil ── */}
      <div className="flex items-center justify-between animate-slide-up pt-1">
        <div>
          <p className="text-muted text-sm">Bienvenido de nuevo</p>
          <h1 className="text-2xl font-black">{user?.username ?? '…'}</h1>
        </div>
        <Link
          href="/settings"
          className="w-10 h-10 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-lg hover:border-primary transition-colors"
          title="Ajustes"
        >
          ⚙️
        </Link>
      </div>

      {/* ── XP / Nivel barra ── */}
      {stats && (
        <div className="card p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">Nv {stats.level}</span>
              <TierBadge tier={tierForElo(stats.elo).tier} />
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-primary">{stats.elo} ELO</span>
              <p className="text-xs text-muted">{stats.wins}V · {stats.losses}D</p>
            </div>
          </div>
          <div className="h-2 bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-1">
            {stats.xpInCurrentLevel} / {stats.xpToNextLevel} XP para nivel {stats.level + 1}
          </p>
        </div>
      )}

      {/* ── Daily Challenge — destacado ── */}
      <Link
        href="/daily"
        className={cn(
          'block rounded-2xl p-5 border transition-all animate-slide-up relative overflow-hidden',
          dailyStatus?.completed
            ? 'bg-primary/10 border-primary/40'
            : 'bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/30 hover:border-amber-400/60',
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📅</span>
              {dailyStatus && dailyStatus.streak > 0 ? (
                <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full">
                  🔥 {dailyStatus.streak} días seguidos
                </span>
              ) : null}
            </div>
            <h2 className={cn(
              'font-black text-xl',
              dailyStatus?.completed ? 'text-primary' : 'text-white'
            )}>
              {dailyStatus?.completed ? '✓ Reto completado' : 'Reto del Día'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {dailyStatus?.completed
                ? `${dailyStatus.entry?.correctCount ?? 0}/${GAME.DAILY_QUESTION_COUNT} correctas · ${dailyStatus.entry?.score ?? 0} pts`
                : `${GAME.DAILY_QUESTION_COUNT} preguntas · Compite con todos los usuarios`}
            </p>
          </div>
          <span className="text-3xl opacity-30 absolute right-4 top-4">
            {dailyStatus?.completed ? '🏅' : '🎯'}
          </span>
        </div>
      </Link>

      {/* ── Modos principales ── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Modos de juego</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/solo"
            className="card p-4 hover:border-primary/60 transition-colors group animate-slide-up"
          >
            <span className="text-3xl block mb-3">🎯</span>
            <h3 className="font-bold group-hover:text-primary transition-colors">Práctica Solo</h3>
            <p className="text-xs text-muted mt-1">
              {QuestionCategorySchema.options.length} categorías · Tú contra el tiempo
            </p>
          </Link>

          <Link
            href="/pvp"
            className="card p-4 hover:border-red-500/60 transition-colors group animate-slide-up relative overflow-hidden"
          >
            <span className="text-3xl block mb-3">⚔️</span>
            <h3 className="font-bold group-hover:text-red-400 transition-colors">PvP 1v1</h3>
            <p className="text-xs text-muted mt-1">Reta a un colega · Tiempo real</p>
            <span className="absolute top-2 right-2 text-xs text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded-full">
              LIVE
            </span>
          </Link>

          <Link
            href="/study"
            className="card p-4 hover:border-primary/60 transition-colors group animate-slide-up"
          >
            <span className="text-3xl block mb-3">📚</span>
            <h3 className="font-bold group-hover:text-primary transition-colors">Modo Estudio</h3>
            <p className="text-xs text-muted mt-1">Sin presión · Con explicaciones</p>
          </Link>

          <Link
            href="/mnemonics"
            className="card p-4 hover:border-amber-500/60 transition-colors group animate-slide-up"
          >
            <span className="text-3xl block mb-3">🧠</span>
            <h3 className="font-bold group-hover:text-amber-400 transition-colors">Reglas rápidas</h3>
            <p className="text-xs text-muted mt-1">Trucos para no olvidar nada</p>
          </Link>
        </div>
      </section>

      {/* ── Atajos inferiores ── */}
      <section className="grid grid-cols-3 gap-2 animate-slide-up">
        <Link
          href="/achievements"
          className="card p-3 text-center hover:border-primary/50 transition-colors"
        >
          <span className="text-2xl block">🏆</span>
          <span className="text-xs text-muted mt-1 block">Logros</span>
        </Link>
        <Link
          href="/leaderboard"
          className="card p-3 text-center hover:border-primary/50 transition-colors"
        >
          <span className="text-2xl block">🥇</span>
          <span className="text-xs text-muted mt-1 block">Ranking</span>
        </Link>
        <Link
          href={user ? `/profile/${encodeURIComponent(user.username)}` : '/lobby'}
          className="card p-3 text-center hover:border-primary/50 transition-colors"
        >
          <span className="text-2xl block">👤</span>
          <span className="text-xs text-muted mt-1 block">Mi perfil</span>
        </Link>
      </section>

      {/* ── Acierto global ── */}
      {stats && (
        <div className="card p-4 animate-slide-up">
          <h3 className="text-sm font-semibold text-muted mb-3">Tu rendimiento global</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-primary">{stats.matchesPlayed}</div>
              <div className="text-xs text-muted">Partidas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-primary">
                {Math.round(stats.accuracy * 100)}%
              </div>
              <div className="text-xs text-muted">Aciertos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-primary">{stats.winStreak}</div>
              <div className="text-xs text-muted">Racha</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
