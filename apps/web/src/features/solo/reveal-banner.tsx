'use client';

import { useAlmagroPhrase } from '@/lib/almagro';
import { ResultSheet } from '@/features/quiz/result-sheet';
import type { RoundResult } from './solo-store';

interface Props {
  result: RoundResult;
  roundIndex: number;
  isLast: boolean;
  busy: boolean;
  onContinue: () => void;
}

export function RevealBanner({ result, roundIndex, isLast, busy, onContinue }: Props) {
  const timedOut = result.pickedOptionId === null;
  const phrase = useAlmagroPhrase(result.isCorrect ? 'correct' : timedOut ? 'timeout' : 'wrong', roundIndex);

  return (
    <ResultSheet
      correct={result.isCorrect}
      title={result.isCorrect ? '¡Correcto!' : timedOut ? 'Se acabó el tiempo' : 'Fallaste'}
      subtitle={
        timedOut
          ? '⏱ Sin respuesta'
          : `${(result.answerMs / 1000).toFixed(1)}s · +${result.scoreGained} pts`
      }
      phrase={phrase}
      explanation={result.explanation}
    >
      <button onClick={onContinue} disabled={busy} className="btn-primary w-full">
        {busy ? 'Cargando…' : isLast ? 'Ver resultados' : 'Siguiente'}
      </button>
    </ResultSheet>
  );
}
