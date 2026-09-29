'use client';

import type { StudyQuestion } from '@carnia/contracts';
import { categoryLabel } from '@/lib/categories';
import { cn } from '@/lib/cn';
import { ExternalImage } from '@/components/external-image';
import { AnswerOptions, optionStateFor } from '@/features/quiz/answer-options';

interface Props {
  question: StudyQuestion;
  picked: string | null;
  isLast: boolean;
  onPick: (optionId: string) => void;
  onNext: () => void;
}

/** Pregunta de estudio: se responde sin tiempo y se revela la explicación al momento. */
export function StudyCard({ question, picked, isLast, onPick, onNext }: Props) {
  const correctId = question.options.find((o) => o.isCorrect)?.id ?? null;
  const isCorrect = picked === correctId;

  return (
    <>
      <div className="card p-5 space-y-4 animate-slide-up">
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
          stateOf={(id) => optionStateFor(id, picked, picked ? correctId : null)}
          onPick={onPick}
          disabled={!!picked}
        />
      </div>

      {picked && (
        <div
          className={cn(
            'card p-4 space-y-2 border animate-slide-up',
            isCorrect ? 'border-win/40 bg-win/5' : 'border-lose/40 bg-lose/5',
          )}
        >
          <div className={cn('font-bold text-sm', isCorrect ? 'text-win' : 'text-lose')}>
            {isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
          </div>
          {question.explanation && <p className="text-sm text-muted leading-relaxed">{question.explanation}</p>}
          <button onClick={onNext} className="btn-primary w-full mt-2">
            {isLast ? 'Ver resultado' : 'Siguiente →'}
          </button>
        </div>
      )}
    </>
  );
}
