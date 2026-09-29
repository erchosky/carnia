"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { studyApi, queryKeys } from "@/lib/content-api";
import { isQuestionCategory } from "@/lib/categories";
import { BackButton } from "@/components/back-button";
import { StudyCard } from "@/features/study/study-card";
import { StudySummary, type StudyAnswer } from "@/features/study/study-summary";

function StudySession() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "flashcards" ? "flashcards" : "weak";
  const rawCategory = params.get("category");
  const category = isQuestionCategory(rawCategory) ? rawCategory : undefined;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<StudyAnswer[]>([]);
  const [finished, setFinished] = useState(false);

  const { data: questions, isLoading, error } = useQuery({
    queryKey: queryKeys.study(mode, category),
    queryFn: () => (mode === "weak" ? studyApi.weakSpots() : studyApi.flashcards(category)),
    // Las flashcards se barajan en el servidor: no refrescar a mitad de sesión.
    staleTime: Infinity,
  });

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted">Preparando preguntas…</div>;
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="space-y-4 text-center py-16">
        <div className="text-4xl">🎯</div>
        <h2 className="font-bold text-lg">No hay preguntas disponibles</h2>
        <p className="text-sm text-muted">
          {error
            ? error.message
            : mode === "weak"
              ? "Juega algunas partidas para ver tus preguntas fallidas aquí."
              : "No hay preguntas en esta categoría."}
        </p>
        <BackButton label="Volver" href="/study" />
      </div>
    );
  }

  if (finished) {
    return (
      <StudySummary
        questions={questions}
        results={results}
        onRestart={() => {
          setCurrentIdx(0);
          setPicked(null);
          setResults([]);
          setFinished(false);
        }}
        onNewSession={() => router.push("/study")}
      />
    );
  }

  const question = questions[currentIdx];
  if (!question) return null;
  const isLast = currentIdx + 1 >= questions.length;
  const progress = ((currentIdx + (picked ? 1 : 0)) / questions.length) * 100;

  const handlePick = (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    const isCorrect = question.options.some((o) => o.id === optionId && o.isCorrect);
    setResults((prev) => [...prev, { questionId: question.id, isCorrect }]);
  };

  const handleNext = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setPicked(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="animate-slide-up space-y-1">
        <BackButton label="← Salir" href="/study" />
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{mode === "weak" ? "Mis fallos" : "Flashcards"}</h1>
          <span className="text-xs text-muted tabular-nums">
            {currentIdx + 1} / {questions.length}
          </span>
        </div>
        <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <StudyCard key={question.id} question={question} picked={picked} isLast={isLast} onPick={handlePick} onNext={handleNext} />
    </div>
  );
}

export default function StudySessionPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-muted">Cargando…</div>}>
      <StudySession />
    </Suspense>
  );
}
