import type {
  AchievementStatus,
  DailyChallenge,
  DailyLeaderboardEntry,
  DailyStatus,
  DailySubmitInput,
  DailySubmitResult,
  LeaderboardResponse,
  QuestionCategory,
  StudyQuestion,
} from '@carnia/contracts';
import { apiFetch, apiSend } from './api';

export const dailyApi = {
  today: () => apiFetch<DailyChallenge>('/api/daily', {}, { auth: false }),
  status: () => apiFetch<DailyStatus>('/api/daily/status'),
  leaderboard: () => apiFetch<DailyLeaderboardEntry[]>('/api/daily/leaderboard', {}, { auth: false }),
  submit: (answers: DailySubmitInput['answers']) =>
    apiSend<DailySubmitResult>('/api/daily/submit', 'POST', { answers }),
};

export const studyApi = {
  weakSpots: () => apiFetch<StudyQuestion[]>('/api/study/weak-spots'),
  flashcards: (category?: QuestionCategory) =>
    apiFetch<StudyQuestion[]>(`/api/study/flashcards${category ? `?category=${category}` : ''}`),
};

export const leaderboardApi = {
  top: (limit = 50) => apiFetch<LeaderboardResponse>(`/api/leaderboard?limit=${limit}`),
};

export const achievementsApi = {
  all: () => apiFetch<AchievementStatus[]>('/api/achievements'),
};

/** Claves de TanStack Query compartidas entre pantallas. */
export const queryKeys = {
  meStats: ['me-stats'] as const,
  dailyStatus: ['daily-status'] as const,
  dailyChallenge: ['daily-challenge'] as const,
  dailyLeaderboard: ['daily-leaderboard'] as const,
  achievements: ['achievements'] as const,
  leaderboard: (limit: number) => ['leaderboard', limit] as const,
  profile: (username: string) => ['profile', username] as const,
  study: (mode: string, category?: string) => ['study', mode, category ?? 'ALL'] as const,
};
