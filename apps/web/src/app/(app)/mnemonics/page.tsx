'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { BackButton } from '@/components/back-button';
import { MNEMONIC_SECTIONS } from '@/features/mnemonics/mnemonic-sections';

export default function MnemonicsPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-1 animate-slide-up">
        <BackButton />
        <h1 className="text-2xl font-bold">🧠 Reglas rápidas</h1>
        <p className="text-muted text-sm">
          Los trucos para recordar lo más importante del examen DGT 2026
        </p>
      </header>

      <div className="space-y-3">
        {MNEMONIC_SECTIONS.map((section) => {
          const isOpen = activeSection === section.id;
          return (
            <div key={section.id} className="card overflow-hidden animate-slide-up">
              <button
                onClick={() => setActiveSection(isOpen ? null : section.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-bg-subtle transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section.emoji}</span>
                  <span className="font-bold">{section.title}</span>
                </div>
                <span className={cn(
                  'text-muted transition-transform duration-200',
                  isOpen ? 'rotate-180' : ''
                )}>
                  ▼
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-bg-border divide-y divide-bg-border">
                  {section.rules.map((rule, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 mt-0.5">{rule.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{rule.title}</p>
                          <div className="inline-block mt-1 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-sm text-xs font-mono text-primary font-bold">
                            {rule.shortcut}
                          </div>
                          <p className="text-sm text-muted mt-2 leading-relaxed">{rule.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-4 border-primary/20 bg-primary/5 animate-slide-up">
        <p className="text-sm text-muted text-center">
          💡 <span className="text-white font-semibold">Consejo:</span> Estudia una sección al día y repásala en Modo Estudio antes de practicar con preguntas.
        </p>
      </div>
    </div>
  );
}
