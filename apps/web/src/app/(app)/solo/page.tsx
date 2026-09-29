'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { GAME, type QuestionCategory } from '@carnia/contracts';
import { soloApi } from '@/lib/solo-api';
import { ALL_CATEGORIES, categoryEmoji, categoryLabel } from '@/lib/categories';
import { useSoloStore } from '@/features/solo/solo-store';
import { BackButton } from '@/components/back-button';
import { cn } from '@/lib/cn';

type Category = QuestionCategory | 'MIXED';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'MIXED', label: 'Mezcla total', emoji: '🎲' },
  ...ALL_CATEGORIES.map((id) => ({ id, label: categoryLabel(id), emoji: categoryEmoji(id) })),
];

export default function SoloPage() {
  const router = useRouter();
  const start = useSoloStore((s) => s.start);
  const [picked, setPicked] = useState<Category>('MIXED');
  const [trapOnly, setTrapOnly] = useState(false);

  const mutation = useMutation({
    mutationFn: soloApi.start,
    onSuccess: (data) => {
      start(data);
      router.push('/solo/play');
    },
  });

  const selected = CATEGORIES.find((c) => c.id === picked)!;

  return (
    <div className="space-y-6">
      <header className="space-y-1 animate-slide-up">
        <BackButton />
        <h1 className="text-2xl font-bold">Modo Solo</h1>
        <p className="text-muted text-sm">
          {GAME.QUESTIONS_PER_MATCH} preguntas · {GAME.QUESTION_DURATION_MS / 1000} segundos · Cuanto más rápido,
          más puntos
        </p>
      </header>

      <section className="animate-slide-up">
        <button
          onClick={() => setTrapOnly((v) => !v)}
          aria-pressed={trapOnly}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
            trapOnly
              ? 'bg-warn/20 border-warn text-warn'
              : 'bg-bg-card border-bg-border text-muted hover:border-warn/50',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪤</span>
            <div className="text-left">
              <div className="font-semibold text-white text-sm">Modo Trampa</div>
              <div className="text-xs text-muted">Solo preguntas con respuestas engañosas</div>
            </div>
          </div>
          <div
            className={cn(
              'w-10 h-5 rounded-full transition-colors flex items-center px-0.5',
              trapOnly ? 'bg-warn' : 'bg-bg-border',
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                trapOnly ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </div>
        </button>
      </section>

      <section className="space-y-3 animate-slide-up">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Elige categoría</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setPicked(cat.id)}
              aria-pressed={picked === cat.id}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all text-left',
                picked === cat.id
                  ? 'bg-primary/20 border-primary text-white'
                  : 'bg-bg-card border-bg-border text-white hover:border-primary/50',
              )}
            >
              <span className="text-xl shrink-0">{cat.emoji}</span>
              <span className="leading-tight">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 space-y-2 animate-slide-up">
        <button
          className="btn-primary w-full text-base py-4"
          onClick={() => mutation.mutate({ category: picked, trapOnly })}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? 'Preparando…'
            : `${trapOnly ? '🪤 Trampa — ' : ''}Jugar — ${selected.emoji} ${selected.label}`}
        </button>
        {mutation.error && <p className="text-sm text-accent text-center mt-2">{mutation.error.message}</p>}
      </div>
    </div>
  );
}
