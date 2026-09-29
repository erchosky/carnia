'use client';

import type { StudyQuestion } from '@carnia/contracts';

export interface StudyAnswer {
  questionId: string;
  isCorrect: boolean;
}

interface Props {
  questions: StudyQuestion[];
  results: StudyAnswer[];
  onRestart: () => void;
  onNewSession: () => void;
}

export function StudySummary({ questions, results, onRestart, onNewSession }: Props) {
  const correct = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrong = results
    .filter((r) => !r.isCorrect)
    .map((r) => questions.find((q) => q.id === r.questionId))
    .filter((q): q is StudyQuestion => q !== undefined);

  return (
    <div className="space-y-6">
      <div className="card p-6 text-center space-y-4 animate-pop-in">
        <div className="text-5xl">{accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}</div>
        <h2 className="font-bold text-xl">Sesión completada</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-3xl font-black text-accent">{accuracy}%</div>
            <div className="text-xs text-muted">Acierto</div>
          </div>
          <div>
            <div className="text-3xl font-black text-win">{correct}</div>
            <div className="text-xs text-muted">Correctas</div>
          </div>
          <div>
            <div className="text-3xl font-black text-lose">{total - correct}</div>
            <div className="text-xs text-muted">Falladas</div>
          </div>
        </div>
      </div>

      {wrong.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Preguntas falladas ({wrong.length})
          </h3>
          {wrong.map((q) => (
            <div key={q.id} className="card p-4 space-y-2 border-red-900/40">
              <p className="text-sm font-medium">{q.prompt}</p>
              <p className="text-xs text-win">✓ {q.options.find((o) => o.isCorrect)?.text}</p>
              {q.explanation && <p className="text-xs text-muted leading-relaxed">{q.explanation}</p>}
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onRestart} className="btn-secondary">
          Repetir
        </button>
        <button onClick={onNewSession} className="btn-primary">
          Nueva sesión
        </button>
      </div>
    </div>
  );
}
