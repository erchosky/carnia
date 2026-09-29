'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soloApi } from '@/lib/solo-api';
import { queryKeys } from '@/lib/content-api';
import { useSoloStore } from '@/features/solo/solo-store';
import { TimedQuestion } from '@/features/quiz/timed-question';
import { RevealBanner } from '@/features/solo/reveal-banner';
import { SummaryScreen } from '@/features/solo/summary-screen';
import { useAuthStore } from '@/stores/auth-store';

export default function SoloPlayPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const state = useSoloStore();
  const submittedRef = useRef<number | null>(null);

  // Sin sesión (entrada directa o recarga): vuelve a la configuración.
  useEffect(() => {
    if (state.phase === 'idle' || !state.sessionId) router.replace('/solo');
  }, [state.phase, state.sessionId, router]);

  const answerMutation = useMutation({
    mutationFn: soloApi.answer,
    onSuccess: (response) => {
      state.applyAnswer(response);
      const user = useAuthStore.getState().user;
      if (response.finished && user) {
        useAuthStore.getState().setUser({
          ...user,
          xp: response.finished.newTotalXp,
          level: response.finished.newLevel,
        });
        qc.invalidateQueries({ queryKey: queryKeys.meStats });
      }
    },
    // Permite reintentar la misma ronda si la petición falla.
    onError: () => {
      submittedRef.current = null;
    },
  });

  const nextMutation = useMutation({
    mutationFn: soloApi.next,
    onSuccess: (round) => {
      submittedRef.current = null;
      state.openRound(round);
    },
  });

  const submit = (optionId: string | null) => {
    if (!state.sessionId || !state.round) return;
    if (submittedRef.current === state.round.roundIndex) return;
    submittedRef.current = state.round.roundIndex;
    if (optionId) state.pickOption(optionId);
    answerMutation.mutate({ sessionId: state.sessionId, roundIndex: state.round.roundIndex, optionId });
  };

  const onContinue = () => {
    if (!state.hasNext) state.showSummary();
    else if (state.sessionId) nextMutation.mutate(state.sessionId);
  };

  if (state.phase === 'idle' || !state.round) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted">Cargando…</div>;
  }

  if (state.phase === 'finished' && state.summary) {
    return (
      <SummaryScreen
        summary={state.summary}
        totalQuestions={state.totalQuestions}
        onPlayAgain={() => {
          state.reset();
          router.replace('/solo');
        }}
      />
    );
  }

  const reveal = state.phase === 'reveal' ? state.lastResult : null;
  const error = answerMutation.error ?? nextMutation.error;

  return (
    <div className="flex flex-col min-h-[80vh] pb-32">
      <TimedQuestion
        question={state.round.question}
        roundIndex={state.round.roundIndex}
        totalRounds={state.totalQuestions}
        startedAt={state.round.startedAt}
        durationMs={state.round.durationMs}
        pickedOptionId={state.pickedOptionId}
        correctOptionId={reveal?.correctOptionId ?? null}
        onPick={submit}
        onTimeout={() => submit(state.pickedOptionId)}
        locked={answerMutation.isPending || state.pickedOptionId !== null}
        aside={
          <div className="text-right">
            <div className="text-xs text-muted">Puntuación</div>
            <div className="text-2xl font-bold tabular-nums">{state.totalScore}</div>
          </div>
        }
        footer={
          error && (
            <div className="card p-3 text-sm text-accent text-center space-y-2">
              <p>{error.message}</p>
              <button onClick={() => router.replace('/solo')} className="btn-secondary w-full text-sm">
                Volver a empezar
              </button>
            </div>
          )
        }
      />

      {reveal && (
        <RevealBanner
          result={reveal}
          roundIndex={state.round.roundIndex}
          isLast={!state.hasNext}
          busy={nextMutation.isPending}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}
