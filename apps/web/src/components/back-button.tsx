'use client';

import { useRouter } from 'next/navigation';

/** Enlace "← Volver" de las cabeceras. Sin historial previo, va al lobby. */
export function BackButton({ label = '← Volver', href }: { label?: string; href?: string }) {
  const router = useRouter();
  const onClick = () => {
    if (href) router.push(href);
    else if (window.history.length > 1) router.back();
    else router.push('/lobby');
  };
  return (
    <button onClick={onClick} className="text-xs text-muted hover:text-white">
      {label}
    </button>
  );
}
