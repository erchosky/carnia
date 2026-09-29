import type { AuthTokens } from '@carnia/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { endSession } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: unknown,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<AuthTokens> | null = null;

/** Renueva el access token. Las llamadas concurrentes comparten la misma petición. */
export async function refreshAccessToken(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = useAuthStore.getState().tokens?.refreshToken;
  if (!refreshToken) throw new ApiError(401, 'no_refresh', 'No hay sesión');

  refreshPromise = (async () => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      endSession();
      throw new ApiError(res.status, 'refresh_failed', 'Sesión expirada');
    }
    const tokens = (await res.json()) as AuthTokens;
    useAuthStore.getState().setTokens(tokens);
    return tokens;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

interface FetchOptions {
  /** Añade el access token (por defecto true). */
  auth?: boolean;
  /** Reintenta una vez tras renovar el token si la API responde 401 (por defecto true). */
  retry?: boolean;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, opts: FetchOptions = {}): Promise<T> {
  const { auth = true, retry = true } = opts;
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  if (auth) {
    const token = useAuthStore.getState().tokens?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && auth && retry) {
    try {
      await refreshAccessToken();
    } catch {
      throw new ApiError(401, 'unauthorized', 'Sesión expirada');
    }
    return apiFetch<T>(path, init, { auth, retry: false });
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string | string[];
      issues?: unknown;
    };
    const message = Array.isArray(payload.message) ? payload.message.join('. ') : payload.message;
    throw new ApiError(res.status, payload.code ?? 'error', message ?? `Error ${res.status}`, payload.issues);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Atajo para peticiones con cuerpo JSON. */
export function apiSend<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}
