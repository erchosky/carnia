'use client';

import type { GameModeOption, QuestionCategory, RoomConfig } from '@carnia/contracts';
import { ALL_CATEGORIES, categoryLabel } from '@/lib/categories';
import { cn } from '@/lib/cn';
import { Chip } from '@/components/chip';

const GAME_MODES: Array<{ id: GameModeOption; icon: string; name: string; description: string; accent: string }> = [
  { id: 'PVP_1V1', icon: '⚔️', name: 'PvP 1v1', description: 'Clásico. El que más puntos acumule gana.', accent: 'border-accent' },
  { id: 'SURVIVAL', icon: '❤️', name: 'Supervivencia', description: '3 vidas. Cada fallo te cuesta una. Sin vidas, eliminado.', accent: 'border-red-400' },
  { id: 'BLITZ', icon: '⚡', name: 'Blitz', description: 'Velocidad máxima. Reveal rápido, sin descanso.', accent: 'border-yellow-400' },
];

const TIMER_OPTIONS: RoomConfig['questionDurationMs'][] = [5000, 10000, 15000, 30000];
const ROUND_OPTIONS: RoomConfig['totalRounds'][] = [5, 10, 15, 20];

interface Props {
  value: RoomConfig;
  onChange: (config: RoomConfig) => void;
}

/** Configuración de una sala privada: modo, tiempo, rondas y categorías. */
export function RoomConfigForm({ value, onChange }: Props) {
  const categories = value.categories ?? [];
  const toggleCategory = (cat: QuestionCategory) => {
    const next = categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat];
    onChange({ ...value, categories: next.length > 0 ? next : null });
  };

  return (
    <>
      <Section title="Modo de juego">
        <div className="grid gap-2">
          {GAME_MODES.map((mode) => {
            const active = value.gameMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onChange({ ...value, gameMode: mode.id })}
                aria-pressed={active}
                className={cn(
                  'card p-4 flex items-start gap-4 text-left transition-all',
                  active ? `${mode.accent} bg-bg-subtle` : 'hover:border-white/20',
                )}
              >
                <span className="text-2xl mt-0.5">{mode.icon}</span>
                <div className="flex-1">
                  <span className="font-bold text-sm">{mode.name}</span>
                  <p className="text-xs text-muted mt-0.5">{mode.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Tiempo por pregunta">
        <Segmented
          options={TIMER_OPTIONS.map((ms) => ({ value: ms, label: `${ms / 1000}s` }))}
          value={value.questionDurationMs}
          onChange={(questionDurationMs) => onChange({ ...value, questionDurationMs })}
        />
      </Section>

      <Section title="Número de rondas">
        <Segmented
          options={ROUND_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={value.totalRounds}
          onChange={(totalRounds) => onChange({ ...value, totalRounds })}
        />
      </Section>

      <Section
        title="Categorías"
        action={
          <button
            onClick={() => onChange({ ...value, categories: null })}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Todas
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <Chip key={cat} active={categories.includes(cat)} onClick={() => toggleCategory(cat)}>
              {categoryLabel(cat)}
            </Chip>
          ))}
        </div>
        {categories.length === 0 && <p className="text-xs text-muted">Sin filtro — preguntas de todas las categorías.</p>}
      </Section>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all',
            value === opt.value
              ? 'bg-accent border-accent text-white'
              : 'bg-bg-card border-bg-border text-white hover:border-accent/60',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
