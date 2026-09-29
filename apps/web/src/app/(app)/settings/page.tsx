'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { UsernameSchema } from '@carnia/contracts';
import { usersApi } from '@/lib/users-api';
import { endSession } from '@/lib/session';
import { useAuthStore } from '@/stores/auth-store';
import { BackButton } from '@/components/back-button';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

function InlineMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <p
      className={
        type === 'success'
          ? 'text-xs text-green-400'
          : 'text-xs text-red-400'
      }
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Section: Change username
// ---------------------------------------------------------------------------

function UsernameSection() {
  const user = useAuthStore((s) => s.user);
  const [username, setUsername] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: usersApi.updateUsername,
    onSuccess: (data) => {
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({ ...current, username: data.username });
      }
      setUsername('');
      setFeedback({ type: 'success', text: 'Nombre de usuario actualizado correctamente.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) {
      setFeedback({ type: 'error', text: parsed.error.issues[0]?.message ?? 'Nombre no válido' });
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <div className="card p-5 space-y-4">
      <SectionHeader
        title="Cambiar nombre de usuario"
        subtitle={`Nombre actual: ${user?.username ?? '—'}`}
      />
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nuevo nombre de usuario"
          minLength={3}
          maxLength={20}
          required
          className="w-full bg-bg-card border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-accent"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || !username.trim()}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          {feedback && <InlineMessage type={feedback.type} text={feedback.text} />}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Change password
// ---------------------------------------------------------------------------

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: (tokens) => {
      // El servidor cierra las demás sesiones y devuelve tokens nuevos para esta.
      useAuthStore.getState().setTokens(tokens);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ type: 'success', text: 'Contraseña actualizada. Se han cerrado tus otras sesiones.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!currentPassword || !newPassword) return;
    mutation.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="card p-5 space-y-4">
      <SectionHeader
        title="Cambiar contraseña"
        subtitle="Introduce tu contraseña actual y luego la nueva."
      />
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          required
          className="w-full bg-bg-card border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-accent"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nueva contraseña"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          className="w-full bg-bg-card border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-accent"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || !currentPassword || !newPassword}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          {feedback && <InlineMessage type={feedback.type} text={feedback.text} />}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Danger zone
// ---------------------------------------------------------------------------

const CONFIRM_WORD = 'BORRAR';

function DangerSection() {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      endSession();
      router.replace('/');
    },
    onError: (err) => setFeedback(err.message),
  });

  function handleDelete() {
    setFeedback(null);
    mutation.mutate();
  }

  function handleCancel() {
    setShowDialog(false);
    setConfirmText('');
    setFeedback(null);
  }

  return (
    <div className="card p-5 border-red-500/30 space-y-4">
      <SectionHeader
        title="Zona de peligro"
        subtitle="Las acciones aquí son irreversibles. Procede con cuidado."
      />

      {!showDialog ? (
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="btn-danger text-sm px-4 py-1.5"
        >
          Borrar mi cuenta
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-red-400">
            Esta acción es permanente y no se puede deshacer. Se eliminarán tu perfil, logros,
            ranking y partidas en solitario. Las partidas contra otros jugadores se conservan
            de forma anónima en el historial de tus rivales.
          </p>
          <p className="text-xs text-muted">
            Escribe <span className="font-mono font-bold text-red-400">{CONFIRM_WORD}</span> para
            confirmar.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="w-full bg-bg-card border border-red-500/40 rounded-md px-3 py-2 text-sm placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-red-500"
          />
          {feedback && <InlineMessage type="error" text={feedback} />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== CONFIRM_WORD || mutation.isPending}
              className="btn-danger text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Eliminando…' : 'Confirmar y borrar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={mutation.isPending}
              className="btn-secondary text-sm px-4 py-1.5 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <header className="animate-slide-up space-y-1">
        <BackButton />
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted">Gestiona tu perfil y preferencias de cuenta.</p>
      </header>

      <UsernameSection />
      <PasswordSection />
      <DangerSection />
    </div>
  );
}
