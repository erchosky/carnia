'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { QuestionCategory } from '@carnia/contracts';
import { ALL_CATEGORIES, categoryLabel } from '@/lib/categories';
import { BackButton } from '@/components/back-button';
import { Chip } from '@/components/chip';
import { cn } from '@/lib/cn';

type StudyMode = 'weak' | 'flashcards';

const MODES: Array<{ id: StudyMode; icon: string; name: string; desc: string }> = [
  { id: 'weak', icon: '🎯', name: 'Mis fallos', desc: 'Las preguntas que más has fallado en partidas.' },
  { id: 'flashcards', icon: '📚', name: 'Flashcards', desc: 'Repasa preguntas con respuesta inmediata, por categoría o todas mezcladas.' },
];

export default function StudyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<StudyMode>('weak');
  const [category, setCategory] = useState<QuestionCategory | null>(null);

  const start = () => {
    const params = new URLSearchParams({ mode });
    if (mode === 'flashcards' && category) params.set('category', category);
    router.push(`/study/session?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <header className="animate-slide-up space-y-1">
        <BackButton />
        <h1 className="text-2xl font-bold">Modo Estudio</h1>
        <p className="text-sm text-muted">Practica sin presión de tiempo.</p>
      </header>

      <section className="space-y-3 animate-slide-up">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Modo</h2>
        <div className="grid gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={cn(
                'card p-4 flex items-start gap-4 text-left transition-all',
                mode === m.id ? 'border-accent bg-bg-subtle' : 'hover:border-white/20',
              )}
            >
              <span className="text-2xl mt-0.5">{m.icon}</span>
              <div>
                <span className="font-bold text-sm">{m.name}</span>
                <p className="text-xs text-muted mt-0.5">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {mode === 'flashcards' && (
        <section className="space-y-3 animate-slide-up">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Categoría</h2>
          <div className="flex flex-wrap gap-2">
            <Chip active={category === null} onClick={() => setCategory(null)}>
              Todas
            </Chip>
            {ALL_CATEGORIES.map((cat) => (
              <Chip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
                {categoryLabel(cat)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <button onClick={start} className="btn-primary w-full animate-pulse-glow">
        Empezar sesión
      </button>
    </div>
  );
}
