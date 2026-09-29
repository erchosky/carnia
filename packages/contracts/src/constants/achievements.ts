export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** Fuente única de verdad para los logros (API y web). */
export const ACHIEVEMENTS = {
  first_win: { id: 'first_win', name: 'Primera Victoria', description: 'Gana tu primera partida PvP', icon: '🏆' },
  win_streak_3: { id: 'win_streak_3', name: 'En racha', description: '3 victorias PvP seguidas', icon: '🔥' },
  win_streak_5: { id: 'win_streak_5', name: 'Imparable', description: '5 victorias PvP seguidas', icon: '⚡' },
  perfect_match: { id: 'perfect_match', name: 'Perfecto PvP', description: 'Acierta todas en un match PvP de 10+ rondas', icon: '💯' },
  perfect_solo: { id: 'perfect_solo', name: 'Perfecto Solo', description: '10/10 correctas en modo solo', icon: '🌟' },
  daily_7: { id: 'daily_7', name: 'Semana perfecta', description: '7 días seguidos con reto diario', icon: '📅' },
  daily_30: { id: 'daily_30', name: 'Constante', description: '30 días seguidos con reto diario', icon: '🗓️' },
  elo_1200: { id: 'elo_1200', name: 'Competidor', description: 'Alcanza 1200 de ELO', icon: '🎯' },
  elo_1500: { id: 'elo_1500', name: 'Élite', description: 'Alcanza 1500 de ELO', icon: '👑' },
  matches_10: { id: 'matches_10', name: 'Veterano', description: '10 partidas jugadas (PvP o Solo)', icon: '🎮' },
  matches_50: { id: 'matches_50', name: 'Dedicado', description: '50 partidas jugadas (PvP o Solo)', icon: '💪' },
  speed_demon: { id: 'speed_demon', name: 'Rayo', description: 'Responde en menos de 3 segundos 5 veces en una partida', icon: '⚡' },
  trap_master: { id: 'trap_master', name: 'No me engañas', description: 'Completa el Modo Trampa con 8+ correctas', icon: '🪤' },
} as const satisfies Record<string, AchievementDefinition>;

export type AchievementId = keyof typeof ACHIEVEMENTS;

export function isAchievementId(id: string): id is AchievementId {
  return Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, id);
}

export interface AchievementStatus extends AchievementDefinition {
  earned: boolean;
  earnedAt: string | null;
}
