"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePvpSocket } from "@/features/pvp/use-pvp-socket";
import { usePvpStore } from "@/features/pvp/pvp-store";
import { useAuthStore } from "@/stores/auth-store";
import { TimedQuestion } from "@/features/quiz/timed-question";
import { PvpRevealBanner } from "@/features/pvp/pvp-reveal-banner";
import { PvpResult } from "@/features/pvp/pvp-result";
import { ScoreBoard } from "@/features/pvp/score-board";
import { emitWithAck } from "@/lib/socket";
import { authApi } from "@/lib/auth-api";
import { queryKeys } from "@/lib/content-api";

export default function PvpMatchPage() {
  const router = useRouter();
  const { matchId: routeMatchId } = useParams<{ matchId: string }>();
  const qc = useQueryClient();
  const socket = usePvpSocket();
  const user = useAuthStore((s) => s.user);

  const matchId = usePvpStore((s) => s.matchId) ?? routeMatchId;
  const phase = usePvpStore((s) => s.phase);
  const currentRound = usePvpStore((s) => s.currentRound);
  const pickedOptionId = usePvpStore((s) => s.pickedOptionId);
  const pickOption = usePvpStore((s) => s.pickOption);
  const lastReveal = usePvpStore((s) => s.lastReveal);
  const players = usePvpStore((s) => s.players);
  const scores = usePvpStore((s) => s.scores);
  const opponentAnswered = usePvpStore((s) => s.opponentAnswered);
  const matchEnd = usePvpStore((s) => s.matchEnd);
  const totalRounds = usePvpStore((s) => s.totalRounds);
  const rematchRequests = usePvpStore((s) => s.rematchRequestsFrom);
  const countdownSeconds = usePvpStore((s) => s.countdownSeconds);
  const lives = usePvpStore((s) => s.lives);
  const reset = usePvpStore((s) => s.reset);

  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const xpSyncedFor = useRef<string | null>(null);

  // Una revancha crea un match nuevo: la URL sigue al match actual.
  useEffect(() => {
    if (matchId !== routeMatchId) router.replace(`/pvp/match/${matchId}`);
  }, [matchId, routeMatchId, router]);

  // Resync al entrar, al volver del background o al reconectar.
  useEffect(() => {
    if (!socket) return;
    const resync = () => socket.emit("match:resync", { matchId });
    const onVisible = () => document.visibilityState === "visible" && resync();
    resync();
    socket.on("connect", resync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      socket.off("connect", resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [socket, matchId]);

  // Al terminar, refresca XP/nivel desde el servidor (una vez por match).
  useEffect(() => {
    if (!matchEnd || xpSyncedFor.current === matchEnd.matchId) return;
    xpSyncedFor.current = matchEnd.matchId;
    authApi
      .me()
      .then((me) => useAuthStore.getState().setUser(me))
      .catch(() => undefined);
    qc.invalidateQueries({ queryKey: queryKeys.meStats });
  }, [matchEnd, qc]);

  const submit = (optionId: string) => {
    if (!socket || !currentRound || pickedOptionId) return;
    pickOption(optionId);
    setSubmitting(true);
    setAnswerError(null);
    emitWithAck(socket, "match:answer", {
      matchId: currentRound.matchId,
      roundIndex: currentRound.roundIndex,
      optionId,
    })
      .catch((err: Error) => setAnswerError(err.message))
      .finally(() => setSubmitting(false));
  };

  const leave = () => {
    socket?.emit("room:leave");
    reset();
    router.replace("/lobby");
  };

  if (!user) return null;

  if (phase === "finished" && matchEnd) {
    return (
      <PvpResult
        result={matchEnd}
        players={players}
        meUserId={user.id}
        totalRounds={totalRounds}
        rematchRequestsFrom={rematchRequests}
        onRematch={(accept) => socket?.emit("match:rematch", { accept })}
        onLeave={leave}
      />
    );
  }

  if (phase === "countdown" || phase === "lobby" || !currentRound) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 animate-pop-in">
          <p className="text-muted">Empezamos en…</p>
          <div className="text-9xl font-black text-accent tabular-nums">{countdownSeconds ?? "·"}</div>
          <button onClick={leave} className="btn-ghost text-xs">
            Salir
          </button>
        </div>
      </div>
    );
  }

  const reveal = phase === "reveal" ? lastReveal : null;

  return (
    <div className="flex flex-col min-h-[80vh] pb-32 gap-4">
      <ScoreBoard
        players={players}
        scores={scores}
        meUserId={user.id}
        opponentAnswered={opponentAnswered}
        lives={lives}
      />
      <TimedQuestion
        question={currentRound.question}
        roundIndex={currentRound.roundIndex}
        totalRounds={currentRound.totalRounds}
        startedAt={currentRound.startedAt}
        durationMs={currentRound.durationMs}
        pickedOptionId={pickedOptionId}
        correctOptionId={reveal?.correctOptionId ?? null}
        onPick={submit}
        // El servidor cierra la ronda por timeout; el cliente no envía nada.
        onTimeout={() => undefined}
        locked={submitting || pickedOptionId !== null}
        footer={
          !reveal &&
          (answerError ? (
            <p className="text-center text-sm text-accent">{answerError}</p>
          ) : (
            pickedOptionId && <p className="text-center text-sm text-muted animate-pop-in">Esperando rival…</p>
          ))
        }
      />
      {reveal && <PvpRevealBanner reveal={reveal} meUserId={user.id} players={players} />}
    </div>
  );
}
