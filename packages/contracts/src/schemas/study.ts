import type { QuestionPublic } from './question.js';

/** Pregunta con la respuesta revelada, para los modos de estudio. */
export interface StudyQuestion extends Omit<QuestionPublic, 'options'> {
  explanation: string;
  options: Array<QuestionPublic['options'][number] & { isCorrect: boolean }>;
  /** Solo en "Mis fallos": veces que el usuario la ha fallado. */
  wrongCount?: number;
}
