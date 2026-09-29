import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@carnia/contracts';
import { apiFetch } from './api';

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const authApi = {
  register: (data: RegisterInput) => apiFetch<AuthResponse>('/api/auth/register', post(data), { auth: false }),
  login: (data: LoginInput) => apiFetch<AuthResponse>('/api/auth/login', post(data), { auth: false }),
  logout: (refreshToken: string) => apiFetch<void>('/api/auth/logout', post({ refreshToken }), { auth: false }),
  me: () => apiFetch<PublicUser>('/api/auth/me'),
};
