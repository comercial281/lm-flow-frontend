import { Star } from 'lucide-react';
import { numberState, type NumberState } from './peopleFilters';
import type { MemberNumber } from '@/types/teamAccess';

/* Chip de um número na lista de Pessoas: bolinha da situação + o NOME do número
   (o que a pessoa digitou), e uma estrela quando ela é a dona. */

export const STATE_TEXT: Record<NumberState, string> = {
  connected: 'Conectado',
  waiting: 'Esperando conectar',
  disconnected: 'Desconectado',
  unknown: 'Sem informação de conexão',
};

export const DOT_CLASS: Record<NumberState, string> = {
  connected: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  disconnected: 'bg-red-500',
  unknown: 'bg-slate-400',
};

/* A situação ESCRITA, só para quem tem problema. O `title` sozinho não basta:
   na lista, a linha inteira é um botão por baixo e o chip não recebe o ponteiro,
   então o balão nunca aparecia. Conectado fica só com a bolinha (é o normal). */
const SHORT_TEXT: Partial<Record<NumberState, { text: string; className: string }>> = {
  waiting: { text: 'esperando conectar', className: 'text-amber-700 dark:text-amber-400' },
  disconnected: { text: 'desconectado', className: 'text-red-600 dark:text-red-400' },
};

export default function NumberChip({ number }: { number: MemberNumber }) {
  const state = numberState(number);
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
      title={`${number.name} · ${STATE_TEXT[state]}`}
    >
      <span data-state={state} className={`h-2 w-2 flex-none rounded-full ${DOT_CLASS[state]}`} aria-hidden="true" />
      <span className="truncate">{number.name}</span>
      {SHORT_TEXT[state]
        ? <span className={`flex-none ${SHORT_TEXT[state]!.className}`}>{SHORT_TEXT[state]!.text}</span>
        : <span className="sr-only">{`, ${STATE_TEXT[state]}`}</span>}
      {number.owner && (
        <Star className="h-3 w-3 flex-none fill-amber-400 text-amber-500" aria-label="dono do número" role="img" />
      )}
    </span>
  );
}
