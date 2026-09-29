"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePvpSocket } from "@/features/pvp/use-pvp-socket";
import { useSocketStore } from "@/stores/socket-store";
import { emitWithAck } from "@/lib/socket";
import { usePvpStore } from "@/features/pvp/pvp-store";

export default function AutoJoinPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const socket = usePvpSocket();
  const status = useSocketStore((s) => s.status);
  const reset = usePvpStore((s) => s.reset);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (status !== "connected" || !socket || attemptedRef.current) return;
    attemptedRef.current = true;

    reset();
    emitWithAck(socket, "room:join", {
      code: code.toUpperCase(),
    })
      .then(() => {
        router.replace(`/pvp/room/${code.toUpperCase()}`);
      })
      .catch((err) => {
        // Failed to join — redirect to pvp hub with error
        router.replace(
          `/pvp?join_error=${encodeURIComponent((err as Error).message)}`,
        );
      });
  }, [status, socket, code, reset, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 animate-pop-in">
        <div className="text-5xl">🔗</div>
        <p className="text-muted text-sm">Entrando a la sala…</p>
        <div className="text-2xl font-mono font-black tracking-widest text-accent">
          {code.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
