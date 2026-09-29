'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  correct: boolean;
  title: string;
  subtitle: string;
  aside?: ReactNode;
  phrase: string | null;
  explanation: string;
  children?: ReactNode;
}

/** Panel inferior tras responder: acierto/fallo, frase y explicación. */
export function ResultSheet({ correct, title, subtitle, aside, phrase, explanation, children }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-4 animate-slide-up">
      <div
        className={cn(
          'max-w-3xl mx-auto card border-2 p-5 space-y-3',
          correct
            ? 'border-win shadow-[0_-10px_40px_-10px_rgba(22,197,102,0.4)]'
            : 'border-lose shadow-[0_-10px_40px_-10px_rgba(255,61,87,0.4)]',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{correct ? '✅' : '❌'}</span>
            <div>
              <div className="font-bold text-lg">{title}</div>
              <div className="text-xs text-muted">{subtitle}</div>
            </div>
          </div>
          {aside}
        </div>
        {phrase && <p className="text-xs text-muted italic">🚗 {phrase}</p>}
        <p className="text-sm text-muted leading-relaxed">{explanation}</p>
        {children}
      </div>
    </div>
  );
}
