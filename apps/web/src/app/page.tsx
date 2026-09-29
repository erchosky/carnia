'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function LandingPage() {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && user) router.replace('/lobby');
  }, [hydrated, user, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md w-full space-y-8 animate-slide-up">
        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
            Carn<span className="text-accent">IA</span>
          </h1>
          <p className="text-muted text-lg">
            El test del carnet, pero competitivo.<br />
            Reta a tus colegas en tiempo real.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/register" className="btn-primary w-full">
            Crear cuenta gratis
          </Link>
          <Link href="/login" className="btn-secondary w-full">
            Ya tengo cuenta
          </Link>
        </div>

        <p className="text-xs text-muted">
          DGT · Permiso B · España
        </p>
      </div>
    </main>
  );
}
