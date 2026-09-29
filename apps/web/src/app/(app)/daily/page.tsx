"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailySubmitResult } from "@carnia/contracts";
import { dailyApi, queryKeys } from "@/lib/content-api";
import { categoryLabel } from "@/lib/categories";
import { useAuthStore } from "@/stores/auth-store";
import { ExternalImage } from "@/components/external-image";
import { BackButton } from "@/components/back-button";
import { AnswerOptions } from "@/features/quiz/answer-options";
import { CompletedView, ResultView } from "@/features/daily/daily-results";

/** Pausa tras elegir, para que se vea la selección antes de pasar de pregunta. */
const ADVANCE_DELAY_MS = 800;

export default function DailyChallengePage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<DailySubmitResult | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const challenge = useQuery({ queryKey: queryKeys.dailyChallenge, queryFn: dailyApi.today });
  const status = useQuery({ queryKey: queryKeys.dailyStatus, queryFn: dailyApi.status, enabled: !!user });
  const showResults = !!submitResult || status.data?.completed === true;
  const leaderboard = useQuery({
    queryKey: queryKeys.dailyLeaderboard,
    queryFn: dailyApi.leaderboard,
    enabled: showResults,
  });

  const submitMutation = useMutation({
    mutationFn: dailyApi.submit,
    onSuccess: (data) => {
      setSubmitResult(data);
      qc.invalidateQueries({ queryKey: queryKeys.dailyStatus });
      qc.invalidateQueries({ queryKey: queryKeys.dailyLeaderboard });
    },
  });

  const header = (
    <header className="animate-slide-up space-y-1">
      <BackButton />
      <h1 className="text-2xl font-bold">Reto del Día</h1>
    </header>
  );

  if (challenge.isLoading || status.isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted">Cargando reto del día…</div>;
  }
  if (challenge.error || !challenge.data) {
    return (
      <div className="space-y-6">
        {header}
        <p className="card p-5 text-center text-accent text-sm">
          {challenge.error?.message ?? "No se pudo cargar el reto de hoy."}
        </p>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div className="space-y-6">
        {header}
        <ResultView
          result={submitResult}
          questions={challenge.data.questions}
          leaderboard={leaderboard.data ?? []}
          userId={user?.id}
        />
      </div>
    );
  }
  if (status.data?.completed) {
    return (
      <div className="space-y-6">
        {header}
        <CompletedView status={status.data} leaderboard={leaderboard.data ?? []} userId={user?.id} />
      </div>
    );
  }

  const questions = challenge.data.questions;
  const question = questions[currentIdx];
  if (!question) return null;

  const handlePick = (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);

    advanceTimer.current = setTimeout(() => {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx((i) => i + 1);
        setPicked(null);
      } else {
        submitMutation.mutate(Object.entries(next).map(([questionId, optionId]) => ({ questionId, optionId })));
      }
    }, ADVANCE_DELAY_MS);
  };

  const progress = ((currentIdx + (picked ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="space-y-6">
      <header className="animate-slide-up space-y-1">
        <BackButton />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Reto del Día</h1>
          <div className="text-xs text-muted tabular-nums">
            {currentIdx + 1} / {questions.length}
          </div>
        </div>
        <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div key={question.id} className="card p-5 space-y-4 animate-slide-up">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-base leading-snug flex-1">{question.prompt}</p>
          <span className="text-xs text-muted bg-bg-subtle px-2 py-1 rounded-full shrink-0">
            {categoryLabel(question.category)}
          </span>
        </div>
        {question.imageUrl && (
          <ExternalImage
            src={question.imageUrl}
            alt=""
            className="w-full rounded-xl object-contain max-h-48 bg-bg-subtle"
          />
        )}
        <AnswerOptions
          options={question.options}
          stateOf={(id) => (picked === null ? "idle" : id === picked ? "picked" : "dimmed")}
          onPick={handlePick}
          disabled={!!picked || submitMutation.isPending}
        />
      </div>

      {submitMutation.error && (
        <div className="card p-4 text-center space-y-2">
          <p className="text-sm text-accent">{submitMutation.error.message}</p>
          <button
            className="btn-secondary w-full text-sm"
            onClick={() =>
              submitMutation.mutate(Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })))
            }
          >
            Reintentar envío
          </button>
        </div>
      )}
    </div>
  );
}
