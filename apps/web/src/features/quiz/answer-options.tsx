'use client';

import type { QuestionOptionPublic } from '@carnia/contracts';
import { cn } from '@/lib/cn';

export type OptionState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dimmed';

interface Props {
  options: QuestionOptionPublic[];
  stateOf: (optionId: string) => OptionState;
  onPick: (optionId: string) => void;
  disabled?: boolean;
}

const OPTION_STYLES: Record<OptionState, string> = {
  idle: 'border-bg-border bg-bg-card hover:border-accent/60',
  picked: 'border-accent bg-accent/10',
  correct: 'border-win bg-win/10',
  wrong: 'border-lose bg-lose/10 animate-shake',
  dimmed: 'border-bg-border bg-bg-card opacity-50',
};

const BADGE_STYLES: Record<OptionState, string> = {
  idle: 'bg-bg-subtle text-muted',
  picked: 'bg-accent text-white',
  correct: 'bg-win text-bg',
  wrong: 'bg-lose text-white',
  dimmed: 'bg-bg-subtle text-muted',
};

/** Lista de opciones A/B/C/D compartida por Solo, PvP, Reto diario y Estudio. */
export function AnswerOptions({ options, stateOf, onPick, disabled = false }: Props) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt, i) => {
        const state = stateOf(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt.id)}
            disabled={disabled}
            className={cn(
              'text-left px-4 py-4 rounded-xl border-2 transition-all flex items-start gap-3 animate-slide-up',
              'disabled:cursor-default',
              OPTION_STYLES[state],
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span
              className={cn(
                'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                BADGE_STYLES[state],
              )}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-sm sm:text-base">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Estado de cada opción: antes de revelar (elegida o no) y después (correcta/fallada). */
export function optionStateFor(
  optionId: string,
  pickedId: string | null,
  correctId: string | null,
): OptionState {
  if (correctId === null) return optionId === pickedId ? 'picked' : 'idle';
  if (optionId === correctId) return 'correct';
  if (optionId === pickedId) return 'wrong';
  return 'dimmed';
}
