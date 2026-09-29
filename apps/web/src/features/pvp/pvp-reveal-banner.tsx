'use client';

import type { RevealPayload } from '@carnia/contracts';
import { useAlmagroPhrase } from '@/lib/almagro';
import { ResultSheet } from '@/features/quiz/result-sheet';

interface Props {
  reveal: RevealPayload;
  meUserId: string;
  players: Array<{ userId: string; username: string }>;
}

export function PvpRevealBanner({ reveal, meUserId, players }: Props) {
  const me = reveal.answers.find((a) => a.userId === meUserId);
  const opp = reveal.answers.find((a) => a.userId !== meUserId);
  const oppPlayer = players.find((p) => p.userId !== meUserId);
  const correct = me?.isCorrect ?? false;
  const answered = !!me?.optionId;
  const phrase = useAlmagroPhrase(me ? (correct ? 'correct' : answered ? 'wrong' : 'timeout') : null, reveal.roundIndex);

  return (
    <ResultSheet
      correct={correct}
      title={correct ? '¡Correcto!' : answered ? 'Fallaste' : 'Se acabó el tiempo'}
      subtitle={answered ? `${((me?.answerMs ?? 0) / 1000).toFixed(1)}s · +${me?.scoreGained ?? 0} pts` : '⏱ Sin respuesta'}
      aside={
        opp &&
        oppPlayer && (
          <div className="text-right text-xs">
            <div className="text-muted">{oppPlayer.username}</div>
            <div className={opp.isCorrect ? 'text-win font-bold' : 'text-lose font-bold'}>
              {opp.isCorrect ? `+${opp.scoreGained}` : opp.optionId ? '0' : '—'}
            </div>
          </div>
        )
      }
      phrase={phrase}
      explanation={reveal.explanation}
    />
  );
}
