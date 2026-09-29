'use client';

import { cn } from '@/lib/cn';

/** Píldora seleccionable (categorías, filtros). */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
        active
          ? 'bg-accent border-accent text-white'
          : 'bg-bg-card border-bg-border text-white/70 hover:border-accent/60 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
