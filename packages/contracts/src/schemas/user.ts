import type { MatchMode } from './match.js';

export interface UserStats {
  xp: number;
  level: number;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  progress: number;
  matchesPlayed: number;
  accuracy: number;
  elo: number;
  wins: number;
  losses: number;
  winStreak: number;
}

export interface MatchSummary {
  id: string;
  mode: MatchMode;
  winnerId: string | null;
  score: number;
  correctCount: number;
  questionCount: number;
  xpEarned: number;
  opponent: { id: string; username: string; avatarUrl: string | null } | null;
  startedAt: string;
  endedAt: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  winStreak: number;
  matchesPlayed: number;
  accuracy: number;
  achievements: Array<{ achievementId: string; earnedAt: string }>;
  recentMatches: MatchSummary[];
}
