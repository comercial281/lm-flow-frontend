import type { CSSProperties } from 'react';
import { VISIT_STATUS_LABELS, type Visit } from '@/services/visits/visitsService';

// Cor da situação da visita num lugar só. Os valores moram em globals.css
// (--visita-<status>), claro e escuro. Nenhuma usa a cor da marca nem roxo.
export type SituacaoDaVisita = Visit['status'];

// Ordem da legenda (a da spec).
const ORDEM: SituacaoDaVisita[] = [
  'scheduled',
  'confirmed',
  'in_progress',
  'rescheduled',
  'completed',
  'no_show',
  'cancelled',
];

export const SITUACOES_DA_LEGENDA: { status: SituacaoDaVisita; rotulo: string }[] = ORDEM.map(
  status => ({ status, rotulo: VISIT_STATUS_LABELS[status] }),
);

export function corDaSituacao(s: string): string {
  const conhecida = (ORDEM as string[]).includes(s) ? s : 'scheduled';
  return `var(--visita-${conhecida})`;
}

export function estiloDaSituacao(s: string): CSSProperties {
  return { '--st': corDaSituacao(s) } as CSSProperties;
}

// Passou do horário e segue Agendada/Confirmada.
export function ehAtrasada(
  v: Pick<Visit, 'status' | 'scheduled_at'>,
  agora: Date = new Date(),
): boolean {
  if (v.status !== 'scheduled' && v.status !== 'confirmed') return false;
  return new Date(v.scheduled_at).getTime() < agora.getTime();
}
