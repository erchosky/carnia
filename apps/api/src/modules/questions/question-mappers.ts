import type { QuestionPublic, StudyQuestion } from '@carnia/contracts';
import type { FullQuestion } from '../game/engine/match-state';

/** Pregunta sin revelar cuál es la opción correcta. */
export function toPublicQuestion(q: FullQuestion): QuestionPublic {
  return {
    id: q.id,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    category: q.category,
    difficulty: q.difficulty,
    isTrap: q.isTrap,
    options: q.options.map((o) => ({ id: o.id, text: o.text, position: o.position })),
  };
}

/** Pregunta con la respuesta y la explicación, para estudio. */
export function toStudyQuestion(q: FullQuestion): StudyQuestion {
  return {
    ...toPublicQuestion(q),
    explanation: q.explanation,
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text,
      position: o.position,
      isCorrect: o.isCorrect,
    })),
  };
}
