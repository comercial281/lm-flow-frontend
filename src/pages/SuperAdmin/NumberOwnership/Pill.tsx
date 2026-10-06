import type { ReactNode } from 'react';
import type { Tone } from './numberOwnershipRules';

// O selo redondo da tela de Números (veredito de dono, situação do número,
// conexão do cliente). Um lugar só para o tom virar cor.
export const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  error: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}
