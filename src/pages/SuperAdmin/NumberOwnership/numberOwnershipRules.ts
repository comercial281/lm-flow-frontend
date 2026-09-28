// Como a aba *Números* do painel raiz mostra o diagnóstico de cada cliente.
//
// Mora fora do JSX porque a regra é testável e a tela não é — a mesma decisão
// das outras traduções do painel raiz. O servidor DECIDE (dono sugerido,
// conflitos, veredito); aqui só se escolhe palavra, cor e ordem.
//
// Linguagem: "número de WhatsApp", nunca instância, inbox ou canal (há spec).

import type {
  OwnershipDiagnosis, OwnershipLiberated, OwnershipNumber, OwnershipRoleta, OwnershipTenant,
} from '@/services/superAdmin/numberOwnershipService';
// L8: `connectionLabel` é a única implementação (mora em `features/numbers`,
// a base que a fase 2b.1 usa em toda tela). Esta função delega — nada de
// manter uma segunda cópia do mesmo switch por estado de conexão.
import { connectionLabel } from '@/features/numbers/numberTexts';

export type RowState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: OwnershipDiagnosis }
  | { kind: 'failed'; message: string };

export interface TenantRow {
  tenant: OwnershipTenant;
  state: RowState;
}

export type Tone = 'ok' | 'warn' | 'error' | 'neutral';

export interface VerdictBadge {
  label: string;
  tone: Tone;
  /** Linha ao lado do selo. Vazio = nada a dizer. */
  note: string;
}

/** O pedido daquele cliente não voltou (queda, tempo esgotado, erro sem corpo). */
export const FAILED_REQUEST_MESSAGE = 'o servidor não respondeu a este cliente';

export function verdictBadge(state: RowState): VerdictBadge {
  if (state.kind === 'loading') return { label: 'lendo…', tone: 'neutral', note: '' };
  if (state.kind === 'failed') return { label: 'Não consegui ler', tone: 'error', note: state.message };

  const { data } = state;
  if (data.verdict === 'unreadable') return { label: 'Não consegui ler', tone: 'error', note: data.reason ?? '' };
  if (data.verdict === 'needs_review') {
    return { label: `Precisa conferir (${data.summary.needs_review})`, tone: 'warn', note: '' };
  }
  return { label: 'Migra sozinho', tone: 'ok', note: '' };
}

export function ownerSourceText(n: Pick<OwnershipNumber, 'source' | 'source_roleta'>): string {
  switch (n.source) {
    case 'responsible':
      return 'pelo Responsável';
    case 'roleta':
      return n.source_roleta ? `pela roleta “${n.source_roleta}”` : 'pela roleta';
    case 'liberated':
      return 'único corretor liberado';
    default:
      return 'Compartilhado';
  }
}

export const connectionText = connectionLabel;

export function roletaLine(r: OwnershipRoleta): string {
  const brokers = r.brokers.length ? r.brokers.map(b => b.name).join(', ') : 'sem corretor';
  const parts = [`Roleta “${r.name}”`, r.shared ? 'Compartilhado' : 'Exclusivo', brokers];
  if (!r.active) parts.push('roleta desligada');
  return parts.join(' · ');
}

export function liberatedLine(list: OwnershipLiberated[]): string {
  if (!list.length) return 'ninguém liberado à mão';
  return list
    .map(p => {
      if (!p.active) return `${p.name} (desativado)`;
      if (!p.corretor) return `${p.name} (gestor)`;
      return p.name;
    })
    .join(', ');
}

// Precisa conferir → não consegui ler → lendo → migra sozinho.
function rank(state: RowState): number {
  if (state.kind === 'loading') return 2;
  if (state.kind === 'failed') return 1;
  if (state.data.verdict === 'needs_review') return 0;
  if (state.data.verdict === 'unreadable') return 1;
  return 3;
}

function reviewCount(state: RowState): number {
  return state.kind === 'ready' ? state.data.summary.needs_review : 0;
}

export function sortRows(rows: TenantRow[]): TenantRow[] {
  return [...rows].sort(
    (a, b) =>
      rank(a.state) - rank(b.state) ||
      reviewCount(b.state) - reviewCount(a.state) ||
      a.tenant.name.localeCompare(b.tenant.name, 'pt-BR'),
  );
}

export function summaryLine(rows: TenantRow[]): string {
  let migrates = 0;
  let review = 0;
  let unreadable = 0;
  let loading = 0;
  for (const { state } of rows) {
    const r = rank(state);
    if (r === 0) review += 1;
    else if (r === 1) unreadable += 1;
    else if (r === 2) loading += 1;
    else migrates += 1;
  }
  const parts = [
    `${migrates} ${migrates === 1 ? 'cliente migra sozinho' : 'clientes migram sozinhos'}`,
    `${review} ${review === 1 ? 'precisa' : 'precisam'} conferir`,
    `${unreadable} não consegui ler`,
  ];
  if (loading) parts.push(`${loading} lendo…`);
  return parts.join(' · ');
}
