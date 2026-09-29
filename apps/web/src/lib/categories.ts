import {
  QUESTION_CATEGORY_EMOJIS,
  QUESTION_CATEGORY_LABELS,
  QuestionCategorySchema,
  type QuestionCategory,
} from '@carnia/contracts';

export const ALL_CATEGORIES: readonly QuestionCategory[] = QuestionCategorySchema.options;

export function isQuestionCategory(value: unknown): value is QuestionCategory {
  return QuestionCategorySchema.safeParse(value).success;
}

export function categoryLabel(category: QuestionCategory): string {
  return QUESTION_CATEGORY_LABELS[category];
}

export function categoryEmoji(category: QuestionCategory): string {
  return QUESTION_CATEGORY_EMOJIS[category];
}
