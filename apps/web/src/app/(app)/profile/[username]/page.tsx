"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ACHIEVEMENTS, isAchievementId, tierForElo, type MatchSummary } from "@carnia/contracts";
import { usersApi } from "@/lib/users-api";
import { queryKeys } from "@/lib/content-api";
import { TierBadge } from "@/features/leaderboard/tier-badge";
import { ExternalImage } from "@/components/external-image";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/cn";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const decoded = decodeURIComponent(username);
  const { data: profile, isLoading, error } = useQuery({
    queryKey: queryKeys.profile(decoded),
    queryFn: () => usersApi.profile(decoded),
  });

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted">Cargando perfil…</div>;
  }

  if (error || !profile) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-4xl">🔍</div>
        <h2 className="font-bold text-lg">Usuario no encontrado</h2>
        <BackButton label="Volver" />
      </div>
    );
  }

  const tier = tierForElo(profile.elo);
  const rankedGames = profile.wins + profile.losses;
  const winRate = rankedGames > 0 ? Math.round((profile.wins / rankedGames) * 100) : 0;
  const earnedAchievements = profile.achievements
    .map((a) => a.achievementId)
    .filter(isAchievementId)
    .map((id) => ACHIEVEMENTS[id]);

  return (
    <div className="space-y-6">
      <header className="animate-slide-up space-y-1">
        <BackButton />
      </header>

      <section className="card p-5 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-subtle flex items-center justify-center text-2xl font-black shrink-0">
            {profile.avatarUrl ? (
              <ExternalImage src={profile.avatarUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              profile.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black truncate">{profile.username}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-muted">Nv. {profile.level}</span>
              <TierBadge tier={tier.tier} />
              {profile.winStreak >= 3 && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                  🔥 Racha de {profile.winStreak}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-bg-border">
          <Stat label="ELO" value={profile.elo} highlight />
          <Stat label="Victorias" value={profile.wins} />
          <Stat label="% victorias" value={`${winRate}%`} />
          <Stat label="Aciertos" value={`${Math.round(profile.accuracy * 100)}%`} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Stat label="Partidas" value={profile.matchesPlayed} />
          <Stat label="Peak ELO" value={profile.peakElo} />
        </div>
      </section>

      {earnedAchievements.length > 0 && (
        <section className="space-y-3 animate-slide-up">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Logros ({earnedAchievements.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {earnedAchievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 bg-bg-subtle border border-yellow-500/20 rounded-full px-3 py-1.5"
                title={a.description}
              >
                <span className="text-base">{a.icon}</span>
                <span className="text-xs font-medium">{a.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.recentMatches.length > 0 && (
        <section className="space-y-3 animate-slide-up">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Últimas partidas</h2>
          <div className="space-y-2">
            {profile.recentMatches.map((m) => (
              <MatchRow key={m.id} match={m} profileId={profile.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchRow({ match: m, profileId }: { match: MatchSummary; profileId: string }) {
  const solo = m.mode === "SOLO";
  const outcome = solo ? "solo" : m.winnerId === profileId ? "win" : m.winnerId ? "loss" : "draw";
  const style = {
    solo: { bar: "bg-primary", text: "text-primary", label: "Solo" },
    win: { bar: "bg-green-500", text: "text-win", label: "Victoria" },
    loss: { bar: "bg-red-500", text: "text-lose", label: "Derrota" },
    draw: { bar: "bg-yellow-500", text: "text-yellow-400", label: "Empate" },
  }[outcome];

  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={cn("w-1.5 h-10 rounded-full shrink-0", style.bar)} />
      <div className="flex-1">
        <div className="text-sm font-medium">
          {solo ? "Práctica solo" : m.opponent ? `vs. ${m.opponent.username}` : "Sin rival"}
        </div>
        <div className="text-xs text-muted">
          {m.correctCount}/{m.questionCount} correctas
        </div>
      </div>
      <div className="text-right">
        <div className={cn("text-xs font-bold", style.text)}>{style.label}</div>
        <div className="text-xs text-muted">{m.score} pts</div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className={cn("text-xl font-bold tabular-nums", highlight && "text-accent")}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
