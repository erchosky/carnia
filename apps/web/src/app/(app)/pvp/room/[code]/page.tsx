"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePvpSocket } from "@/features/pvp/use-pvp-socket";
import { usePvpStore } from "@/features/pvp/pvp-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSocketStore } from "@/stores/socket-store";
import { cn } from "@/lib/cn";

export default function PvpRoomPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const socket = usePvpSocket();
  const user = useAuthStore((s) => s.user);
  const room = usePvpStore((s) => s.room);
  const countdown = usePvpStore((s) => s.countdownSeconds);
  const phase = usePvpStore((s) => s.phase);
  const matchId = usePvpStore((s) => s.matchId);
  const reset = usePvpStore((s) => s.reset);
  const serverError = useSocketStore((s) => s.error);
  const [copied, setCopied] = useState(false);

  // Los errores de pantallas anteriores no aplican a esta sala.
  useEffect(() => useSocketStore.getState().setError(null), []);

  // Cuando arranca el match, pasa a la pantalla de juego.
  useEffect(() => {
    if (matchId && (phase === "question" || phase === "countdown")) {
      router.replace(`/pvp/match/${matchId}`);
    }
  }, [matchId, phase, router]);

  const leave = () => {
    socket?.emit("room:leave");
    reset();
    router.replace("/pvp");
  };

  const toggleReady = () => {
    if (!socket || !user || !room) return;
    const me = room.members.find((m) => m.userId === user.id);
    socket.emit("room:ready", { ready: !me?.ready });
  };

  // Copia solo el código (no la URL) para poder pegarlo en "Entrar por código".
  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: el código sigue visible en pantalla.
    }
  };

  const shareRoom = async () => {
    if (!room) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "CarnIA — Partida PvP",
          text: `¡Úneteme a mi sala! Código: ${room.code}`,
          url: `${window.location.origin}/pvp/join/${room.code}`,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await copyCode();
    }
  };

  const me = user && room?.members.find((m) => m.userId === user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-1 animate-slide-up">
        <button onClick={leave} className="text-xs text-muted hover:text-white">
          ← Salir
        </button>
        <h1 className="text-2xl font-bold">Sala de espera</h1>
      </header>

      <section className="card p-5 space-y-3 animate-slide-up">
        <p className="text-sm text-muted">Comparte este código:</p>
        <button
          onClick={copyCode}
          className="w-full text-5xl font-mono font-black tracking-widest tabular-nums
                     bg-bg-subtle rounded-xl py-5 hover:bg-bg-border transition-colors"
        >
          {room?.code ?? code}
        </button>
        <p className="text-xs text-center text-muted">
          {copied ? "✓ Código copiado" : "Toca para copiar el código"}
        </p>
        <button onClick={shareRoom} className="btn-secondary w-full text-sm">
          Compartir invitación 🔗
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Jugadores ({room?.members.length ?? 0} / 2)
        </h2>
        <div className="grid gap-2">
          {room?.members.map((m) => (
            <div
              key={m.userId}
              className={cn(
                "card p-3 flex items-center justify-between transition-colors",
                m.ready && "border-win",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-subtle flex items-center justify-center text-sm font-bold">
                  {m.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{m.username}</div>
                  <div className="text-xs text-muted">
                    Nivel {m.level}
                    {!m.connected && <span className="text-warn"> · desconectado</span>}
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold">
                {m.ready ? (
                  <span className="text-win">LISTO ✓</span>
                ) : (
                  <span className="text-muted">esperando…</span>
                )}
              </div>
            </div>
          ))}
          {(room?.members.length ?? 0) < 2 && (
            <div className="card p-3 border-dashed flex items-center justify-center text-muted text-sm">
              Esperando rival…
            </div>
          )}
        </div>
      </section>

      <button
        onClick={toggleReady}
        disabled={!me || (room?.members.length ?? 0) < 2}
        className={cn(
          "w-full",
          me?.ready ? "btn-secondary" : "btn-primary animate-pulse-glow",
        )}
      >
        {me?.ready ? "Cancelar listo" : "Estoy listo"}
      </button>

      {serverError && <p className="text-sm text-accent text-center">{serverError}</p>}

      {countdown !== null && (
        <div className="fixed inset-0 z-30 bg-bg/90 backdrop-blur-xs flex items-center justify-center">
          <div className="text-center space-y-4 animate-pop-in">
            <p className="text-muted">Empezamos en…</p>
            <div className="text-9xl font-black text-accent tabular-nums">
              {countdown}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
