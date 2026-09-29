'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RegisterSchema } from '@carnia/contracts';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      router.replace('/lobby');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Error al crear la cuenta');
    },
  });

  return (
    <div className="card p-6 space-y-5 animate-pop-in">
      <h1 className="text-2xl font-bold">Crea tu cuenta</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const parsed = RegisterSchema.safeParse({ email, username, password });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
            return;
          }
          mutation.mutate(parsed.data);
        }}
        className="space-y-3"
      >
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Username (visible para tus rivales)"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-sm text-muted text-center">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
