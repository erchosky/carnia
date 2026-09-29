import type { AuthTokens, ChangePasswordInput, PublicProfile, UserStats } from '@carnia/contracts';
import { apiFetch, apiSend } from './api';

export const usersApi = {
  stats: () => apiFetch<UserStats>('/api/users/me/stats'),
  profile: (username: string) => apiFetch<PublicProfile>(`/api/users/${encodeURIComponent(username)}/profile`),
  updateUsername: (username: string) =>
    apiSend<{ id: string; username: string }>('/api/users/me', 'PATCH', { username }),
  /** Devuelve tokens nuevos: el resto de sesiones quedan cerradas. */
  changePassword: (data: ChangePasswordInput) => apiSend<AuthTokens>('/api/users/me/password', 'PATCH', data),
  deleteAccount: () => apiSend<void>('/api/users/me', 'DELETE'),
};
