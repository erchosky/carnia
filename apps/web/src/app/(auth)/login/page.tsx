'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      router.replace('/lobby');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión');
    },
  });

  return (
    <div className="card p-6 space-y-5 animate-pop-in">
      <h1 className="text-2xl font-bold">Bienvenido de vuelta</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate({ email, password });
        }}
        className="space-y-3"
      >
        <input
          className="input"
          type="email"
          placeholder="email@ejemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="text-sm text-muted text-center">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-accent hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
