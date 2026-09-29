'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { endSession } from '@/lib/session';

export function TopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tokens = useAuthStore((s) => s.tokens);

  const onLogout = () => {
    if (tokens?.refreshToken) authApi.logout(tokens.refreshToken).catch(() => undefined);
    endSession();
    router.replace('/');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-bg/80 border-b border-bg-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/lobby" className="text-xl font-black">
          Carn<span className="text-win">IA</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted hidden sm:inline">Nivel</span>
          <span className="font-bold">{user.level}</span>
          <span className="text-muted hidden sm:inline">·</span>
          <Link href={`/profile/${encodeURIComponent(user.username)}`} className="font-medium hover:text-win">
            {user.username}
          </Link>
          <button onClick={onLogout} className="btn-ghost !px-2 !py-1 text-xs">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
