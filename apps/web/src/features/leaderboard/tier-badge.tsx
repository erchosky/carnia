'use client';

import type { RankTier } from '@carnia/contracts';
import { cn } from '@/lib/cn';

const STYLES: Record<RankTier, { gradient: string; label: string; emoji: string }> = {
  BRONZE: { gradient: 'from-amber-700 to-amber-900', label: 'Bronce', emoji: '🥉' },
  SILVER: { gradient: 'from-slate-400 to-slate-600', label: 'Plata', emoji: '🥈' },
  GOLD: { gradient: 'from-yellow-400 to-yellow-600', label: 'Oro', emoji: '🥇' },
  PLATINUM: { gradient: 'from-cyan-300 to-cyan-600', label: 'Platino', emoji: '💎' },
  DIAMOND: { gradient: 'from-blue-400 to-purple-600', label: 'Diamante', emoji: '🔷' },
  MASTER: { gradient: 'from-pink-500 to-red-600', label: 'Master', emoji: '👑' },
};

export function TierBadge({ tier, className }: { tier: RankTier; className?: string }) {
  const style = STYLES[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold',
        'bg-gradient-to-r text-white',
        style.gradient,
        className,
      )}
    >
      <span>{style.emoji}</span>
      <span>{style.label}</span>
    </span>
  );
}
