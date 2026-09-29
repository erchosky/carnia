'use client';

import { useRouter } from 'next/navigation';
import type { SoloAnswerResponse } from '@carnia/contracts';

type Summary = NonNullable<SoloAnswerResponse['finished']>;

interface Props {
  summary: Summary;
  totalQuestions: number;
  onPlayAgain: () => void;
}

export function SummaryScreen({ summary, totalQuestions, onPlayAgain }: Props) {
  const router = useRouter();
  const accuracy = totalQuestions > 0 ? (summary.correctCount / totalQuestions) * 100 : 0;

  let title = 'Buena partida';
  let emoji = '👏';
  if (summary.perfect) {
    title = '¡PERFECTO!';
    emoji = '🔥';
  } else if (accuracy >= 80) {
    title = '¡Casi perfecto!';
    emoji = '⭐';
  } else if (accuracy < 50) {
    title = 'A repasar el manual';
    emoji = '📖';
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-pop-in">
      <div className="space-y-2">
        <div className="text-7xl">{emoji}</div>
        <h1 className="text-3xl font-black">{title}</h1>
      </div>

      <div className="card p-6 w-full space-y-4">
        <Row label="Puntuación" value={summary.totalScore} highlight />
        <Row label="Aciertos" value={`${summary.correctCount} / ${totalQuestions}`} />
        <Row label="Tiempo medio" value={`${(summary.avgAnswerMs / 1000).toFixed(1)}s`} />
        <div className="border-t border-bg-border pt-3 space-y-3">
          <Row label="XP ganado" value={`+${summary.xpEarned}`} highlight />
          <Row
            label="Nivel"
            value={summary.leveledUp ? `${summary.newLevel} ⬆` : summary.newLevel}
          />
        </div>
        {summary.leveledUp && (
          <div className="bg-accent/10 border border-accent/40 rounded-xl p-3 text-center">
            <p className="text-sm font-semibold text-accent">
              ¡Has subido al nivel {summary.newLevel}!
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button onClick={onPlayAgain} className="btn-primary w-full">
          Otra partida
        </button>
        <button onClick={() => router.replace('/lobby')} className="btn-secondary w-full">
          Volver al lobby
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted text-sm">{label}</span>
      <span className={highlight ? 'text-xl font-bold text-accent tabular-nums' : 'font-semibold tabular-nums'}>
        {value}
      </span>
    </div>
  );
}
