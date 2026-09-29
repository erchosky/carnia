'use client';

import type { DailyLeaderboardEntry, DailyStatus, DailySubmitResult, QuestionPublic } from '@carnia/contracts';
import { GAME } from '@carnia/contracts';
import { cn } from '@/lib/cn';

export function CompletedView({
  status,
  leaderboard,
  userId,
}: {
  status: DailyStatus;
  leaderboard: DailyLeaderboardEntry[];
  userId?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4 animate-slide-up text-center">
        <div className="text-5xl">✅</div>
        <h2 className="font-bold text-lg">¡Ya completaste el reto de hoy!</h2>
        <ScoreGrid
          score={status.entry?.score ?? 0}
          correct={`${status.entry?.correctCount ?? 0}/${GAME.DAILY_QUESTION_COUNT}`}
          streak={status.streak}
        />
        <p className="text-xs text-muted">Vuelve mañana para mantener la racha.</p>
      </div>
      <DailyLeaderboard entries={leaderboard} myUserId={userId} />
    </div>
  );
}

export function ResultView({
  result,
  questions,
  leaderboard,
  userId,
}: {
  result: DailySubmitResult;
  questions: QuestionPublic[];
  leaderboard: DailyLeaderboardEntry[];
  userId?: string;
}) {
  const accuracy = result.total > 0 ? Math.round((result.correctCount / result.total) * 100) : 0;
  const mistakes = result.results.filter((r) => !r.isCorrect);

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4 animate-pop-in text-center">
        <div className="text-5xl">{accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}</div>
        <h2 className="font-bold text-xl">Resultado del día</h2>
        <ScoreGrid score={result.score} correct={`${result.correctCount}/${result.total}`} streak={result.streak} />
      </div>

      {mistakes.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Repaso de errores</h3>
          {mistakes.map((r) => {
            const q = questions.find((q) => q.id === r.questionId);
            if (!q) return null;
            const correct = q.options.find((o) => o.id === r.correctOptionId);
            const yours = q.options.find((o) => o.id === r.yourOptionId);
            return (
              <div key={r.questionId} className="card p-4 space-y-2 border-red-900/50">
                <p className="text-sm font-medium">{q.prompt}</p>
                {yours && <p className="text-xs text-lose">✗ Tu respuesta: {yours.text}</p>}
                <p className="text-xs text-win">✓ Correcta: {correct?.text}</p>
              </div>
            );
          })}
        </section>
      )}

      <DailyLeaderboard entries={leaderboard} myUserId={userId} />
    </div>
  );
}

function ScoreGrid({ score, correct, streak }: { score: number; correct: string; streak: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <div className="text-3xl font-black text-accent">{score}</div>
        <div className="text-xs text-muted">Puntos</div>
      </div>
      <div>
        <div className="text-3xl font-black">{correct}</div>
        <div className="text-xs text-muted">Correctas</div>
      </div>
      <div>
        <div className="text-3xl font-black text-yellow-400">{streak}</div>
        <div className="text-xs text-muted">Racha 🔥</div>
      </div>
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function DailyLeaderboard({ entries, myUserId }: { entries: DailyLeaderboardEntry[]; myUserId?: string }) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Clasificación del día</h3>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.userId}
            className={cn('card p-3 flex items-center gap-3', entry.userId === myUserId && 'border-accent')}
          >
            <div className="text-lg font-black tabular-nums text-muted w-6 text-center">
              {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{entry.username}</div>
              <div className="text-xs text-muted">Nv. {entry.level}</div>
            </div>
            <div className="text-right">
              <div className="font-bold tabular-nums">{entry.score}</div>
              <div className="text-xs text-muted">
                {entry.correctCount}/{GAME.DAILY_QUESTION_COUNT}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
