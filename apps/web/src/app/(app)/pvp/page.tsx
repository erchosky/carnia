"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DEFAULT_ROOM_CONFIG, type RoomConfig } from "@carnia/contracts";
import { usePvpSocket } from "@/features/pvp/use-pvp-socket";
import { usePvpStore } from "@/features/pvp/pvp-store";
import { useMatchmaking } from "@/features/pvp/use-matchmaking";
import { RoomConfigForm } from "@/features/pvp/room-config-form";
import { useSocketStore } from "@/stores/socket-store";
import { emitWithAck } from "@/lib/socket";
import { BackButton } from "@/components/back-button";

function PvpHub() {
  const router = useRouter();
  const joinError = useSearchParams().get("join_error");
  const socket = usePvpSocket();
  const status = useSocketStore((s) => s.status);
  const reset = usePvpStore((s) => s.reset);
  const queue = useMatchmaking(socket);

  const [config, setConfig] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(joinError);

  const ready = !!socket && status === "connected";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    reset();
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      if (!socket) return;
      const res = await emitWithAck(socket, "room:create", { mode: "PVP_1V1", config });
      router.push(`/pvp/room/${res.code}`);
    });

  const join = () =>
    run(async () => {
      const normalized = code.trim().toUpperCase();
      if (!socket || !normalized) return;
      await emitWithAck(socket, "room:join", { code: normalized });
      router.push(`/pvp/room/${normalized}`);
    });

  return (
    <div className="space-y-6">
      <header className="space-y-1 animate-slide-up">
        <BackButton />
        <h1 className="text-2xl font-bold">PvP 1v1</h1>
        <p className="text-sm text-muted">Configura la sala y comparte el código con tu rival.</p>
      </header>

      {!ready && (
        <div className="card p-4 text-sm text-muted text-center">
          {status === "connecting" || status === "idle" ? "Conectando…" : "Sin conexión. Reintentando…"}
        </div>
      )}

      <section className="card p-5 space-y-3 animate-slide-up">
        <div className="space-y-1">
          <h2 className="font-bold">Jugar online</h2>
          <p className="text-xs text-muted">Entra en cola y te uniremos con un rival aleatorio.</p>
        </div>
        {queue.status === "idle" && (
          <button onClick={queue.join} disabled={!ready || busy} className="btn-primary w-full">
            Partida rápida
          </button>
        )}
        {queue.status !== "idle" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {queue.status === "matched" ? "Rival encontrado, entrando…" : "Buscando rival…"}
                </p>
                {queue.status === "searching" && queue.position !== null && (
                  <p className="text-xs text-muted">Posición en cola: {queue.position}</p>
                )}
              </div>
            </div>
            {queue.status === "searching" && (
              <button onClick={queue.leave} className="btn-secondary w-full text-sm">
                Cancelar búsqueda
              </button>
            )}
          </div>
        )}
      </section>

      <Divider label="o crea una sala privada" />
      <RoomConfigForm value={config} onChange={setConfig} />
      <button onClick={create} disabled={!ready || busy} className="btn-primary w-full animate-pulse-glow">
        {busy ? "Creando sala…" : "Crear sala y compartir"}
      </button>

      <Divider label="o entra a una sala" />
      <section className="card p-5 space-y-3 animate-slide-up">
        <h2 className="font-bold">Entrar por código</h2>
        <input
          className="input font-mono tracking-widest uppercase text-center text-xl"
          placeholder="ABC123"
          aria-label="Código de sala"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <button onClick={join} disabled={!ready || busy || code.length < 4} className="btn-secondary w-full">
          {busy ? "…" : "Entrar"}
        </button>
      </section>

      {error && <p className="text-sm text-accent text-center">{error}</p>}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-bg-border" />
      <span className="text-xs text-muted">{label}</span>
      <div className="flex-1 h-px bg-bg-border" />
    </div>
  );
}

export default function PvpHubPage() {
  return (
    <Suspense fallback={null}>
      <PvpHub />
    </Suspense>
  );
}
