'use client';

import type { ReactNode } from 'react';
import type { QuestionPublic } from '@carnia/contracts';
import { cn } from '@/lib/cn';
import { categoryLabel } from '@/lib/categories';
import { ExternalImage } from '@/components/external-image';
import { AnswerOptions, optionStateFor } from './answer-options';
import { useCountdown } from './use-countdown';

interface Props {
  question: QuestionPublic;
  roundIndex: number;
  totalRounds: number;
  /** Inicio de la ronda en reloj local. */
  startedAt: number;
  durationMs: number;
  pickedOptionId: string | null;
  /** Opción correcta una vez revelada; null mientras la pregunta está abierta. */
  correctOptionId: string | null;
  onPick: (optionId: string) => void;
  onTimeout: () => void;
  /** Bloquea las opciones (enviando o ya respondida). */
  locked: boolean;
  /** Contenido a la derecha del temporizador (p. ej. la puntuación en Solo). */
  aside?: ReactNode;
  footer?: ReactNode;
}

/** Pregunta con temporizador, común a Solo y PvP. */
export function TimedQuestion({
  question,
  roundIndex,
  totalRounds,
  startedAt,
  durationMs,
  pickedOptionId,
  correctOptionId,
  onPick,
  onTimeout,
  locked,
  aside,
  footer,
}: Props) {
  const revealing = correctOptionId !== null;
  const { remainingMs, progress } = useCountdown(startedAt, durationMs, !revealing, onTimeout);
  const urgent = remainingMs < 5000 && !revealing;

  return (
    <div className="flex-1 flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          Pregunta <span className="text-white font-bold">{roundIndex + 1}</span>
          <span className="text-muted"> / {totalRounds}</span>
        </span>
        <div className="flex items-center gap-3">
          {question.isTrap && (
            <span className="text-xs uppercase tracking-wider text-warn font-bold animate-pulse">⚠️ Trampa</span>
          )}
          <span className="text-xs uppercase tracking-wider text-muted">{categoryLabel(question.category)}</span>
        </div>
      </div>

      <div className="relative h-2 bg-bg-subtle rounded-full overflow-hidden" aria-hidden>
        <div
          className={cn('absolute inset-y-0 left-0 transition-all', urgent ? 'bg-accent' : 'bg-win')}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div
          className={cn('text-5xl font-black tabular-nums', urgent && 'text-accent animate-pulse')}
          role="timer"
          aria-label="Segundos restantes"
        >
          {Math.ceil(remainingMs / 1000)}
        </div>
        {aside}
      </div>

      <h2 className="text-xl font-bold leading-snug animate-slide-up">{question.prompt}</h2>
      {question.imageUrl && (
        <ExternalImage
          src={question.imageUrl}
          alt=""
          className="w-full rounded-xl object-contain max-h-48 bg-bg-subtle"
        />
      )}

      <AnswerOptions
        options={question.options}
        stateOf={(id) => optionStateFor(id, pickedOptionId, correctOptionId)}
        onPick={(id) => !locked && !revealing && onPick(id)}
        disabled={locked || revealing}
      />
      {footer}
    </div>
  );
}
