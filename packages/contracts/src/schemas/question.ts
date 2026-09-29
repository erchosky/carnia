import { z } from 'zod';

export const QuestionCategorySchema = z.enum([
  'SIGNALS',
  'PRIORITY',
  'OVERTAKING',
  'ROUNDABOUTS',
  'SPEED',
  'ALCOHOL_DRUGS',
  'DOCUMENTATION',
  'ROAD_SAFETY',
  'PARKING',
  'INTERSECTIONS',
  'EFFICIENT_DRIVING',
  'MECHANICS',
  'FIRST_AID',
  'LIGHTING',
  'SAFETY_SYSTEMS',
  'ROAD_USE',
  'CARGO',
  'RISK_FACTORS',
  'VULNERABLE_USERS',
  'ADVERSE_CONDITIONS',
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  SIGNALS: 'Señales',
  PRIORITY: 'Prioridad',
  OVERTAKING: 'Adelantamientos',
  ROUNDABOUTS: 'Glorietas',
  SPEED: 'Velocidad',
  ALCOHOL_DRUGS: 'Alcohol y drogas',
  DOCUMENTATION: 'Documentación',
  ROAD_SAFETY: 'Seguridad vial',
  PARKING: 'Estacionamiento',
  INTERSECTIONS: 'Intersecciones',
  EFFICIENT_DRIVING: 'Eco-conducción',
  MECHANICS: 'Mecánica',
  FIRST_AID: 'Primeros auxilios',
  LIGHTING: 'Alumbrado',
  SAFETY_SYSTEMS: 'Sistemas de seguridad',
  ROAD_USE: 'Uso de la vía',
  CARGO: 'Carga y transporte',
  RISK_FACTORS: 'Factores de riesgo',
  VULNERABLE_USERS: 'Usuarios vulnerables',
  ADVERSE_CONDITIONS: 'Condiciones adversas',
};

export const QUESTION_CATEGORY_EMOJIS: Record<QuestionCategory, string> = {
  SIGNALS: '🚦',
  PRIORITY: '⚠️',
  OVERTAKING: '🏎️',
  ROUNDABOUTS: '🔄',
  SPEED: '⚡',
  ALCOHOL_DRUGS: '🍺',
  DOCUMENTATION: '📄',
  ROAD_SAFETY: '🛡️',
  PARKING: '🅿️',
  INTERSECTIONS: '✚',
  EFFICIENT_DRIVING: '🌱',
  MECHANICS: '🔧',
  FIRST_AID: '🚑',
  LIGHTING: '💡',
  SAFETY_SYSTEMS: '🔒',
  ROAD_USE: '🛣️',
  CARGO: '📦',
  RISK_FACTORS: '😴',
  VULNERABLE_USERS: '🚶',
  ADVERSE_CONDITIONS: '🌧️',
};

export const QuestionOptionPublicSchema = z.object({
  id: z.string(),
  text: z.string(),
  position: z.number().int().min(0).max(3),
});
export type QuestionOptionPublic = z.infer<typeof QuestionOptionPublicSchema>;

/** Lo que el cliente recibe — SIN saber cuál es la correcta. */
export const QuestionPublicSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  imageUrl: z.string().nullable(),
  category: QuestionCategorySchema,
  difficulty: z.number().int().min(1).max(5),
  isTrap: z.boolean(),
  options: z.array(QuestionOptionPublicSchema).length(4),
});
export type QuestionPublic = z.infer<typeof QuestionPublicSchema>;
