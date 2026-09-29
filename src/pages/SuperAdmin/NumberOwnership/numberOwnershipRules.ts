// Como a aba *Números* do painel raiz mostra o diagnóstico de cada cliente.
//
// Mora fora do JSX porque a regra é testável e a tela não é — a mesma decisão
// das outras traduções do painel raiz. O servidor DECIDE (dono sugerido,
// conflitos, veredito); aqui só se escolhe palavra, cor e ordem.
//
// Linguagem: "número de WhatsApp", nunca instância, inbox ou canal (há spec).

import type {
  OwnershipDiagnosis, OwnershipLiberated, OwnershipNumber, OwnershipRoleta, OwnershipRule, OwnershipRuleLast,
  OwnershipTenant,
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

// ── Fase 2b.1: Ligar / Desligar dono do número ───────────────────────────────
//
// Ligar é ESCRITA em produção (grava os donos e muda como o lead é entregue).
// Por isso: o botão só existe quando o servidor sabe ligar (`rule` na
// resposta), só fica clicável no "Migra sozinho", e a confirmação diz o que vai
// acontecer com as contas daquele cliente. Quem recusa de verdade é o servidor
// (e o motivo dele aparece como veio).

export type RuleActionKind = 'enable' | 'disable';

export interface RuleAction {
  kind: RuleActionKind;
  label: string;
  /** Vazio = pode clicar. Preenchido = botão desligado, com isto ao lado. */
  blockedReason: string;
}

/** O formato do useConfirmacao (o Dialog da casa). */
export interface RuleConfirmation {
  titulo: string;
  descricao: string;
  rotuloDaAcao: string;
  destrutivo: boolean;
}

/** O pedido não voltou com motivo (queda, tempo esgotado, erro sem corpo). */
export const RULE_FAILED_MESSAGE =
  'O servidor não respondeu a este pedido. Atualize a aba e confira antes de tentar de novo.';

const NEEDS_REVIEW_REASON =
  'Precisa conferir antes: resolva cada número abaixo em Canais e na Roleta, e clique em Atualizar.';

export function ruleAction(data: OwnershipDiagnosis): RuleAction | null {
  if (!data.rule) return null;
  if (data.rule.enabled) return { kind: 'disable', label: 'Desligar dono do número', blockedReason: '' };
  // "Migra sozinho" E nenhum número com conflito. O servidor já não diz "migra"
  // com conflito; a segunda metade é defesa, porque oferecer um Ligar que ele
  // vai recusar é a tela prometendo o que não entrega.
  const semConflito = data.numbers.every(n => n.conflicts.length === 0 && !(n.conflict_codes?.length));
  if (data.verdict === 'migrates' && semConflito) {
    return { kind: 'enable', label: 'Ligar dono do número', blockedReason: '' };
  }
  if (data.verdict === 'needs_review' || data.verdict === 'migrates') {
    return { kind: 'enable', label: 'Ligar dono do número', blockedReason: NEEDS_REVIEW_REASON };
  }
  return null;
}

export function ruleStatusText(rule: OwnershipRule | null | undefined): string {
  if (!rule) return '';
  return rule.enabled ? 'Dono do número: ligado' : 'Dono do número: desligado';
}

// Lido da própria string: o horário é o do SERVIDOR (o fuso da imobiliária),
// e converter para o fuso do navegador mudaria a hora conforme quem olha.
const ISO_MINUTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function ruleLastLine(last: OwnershipRuleLast | null | undefined): string {
  if (!last) return '';
  const m = ISO_MINUTE.exec(last.at ?? '');
  const quando = m ? ` em ${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '';
  const quem = last.by ? ` por ${last.by}` : '';
  if (last.action === 'enable') {
    const n = last.changed ?? 0;
    return `Ligado${quando}${quem} · ${n} ${n === 1 ? 'dono gravado' : 'donos gravados'}`;
  }
  return `Desligado${quando}${quem}`;
}

export function ruleConfirmation(kind: RuleActionKind, tenantName: string, data: OwnershipDiagnosis): RuleConfirmation {
  if (kind === 'disable') {
    return {
      titulo: `Desligar dono do número em ${tenantName}?`,
      descricao: 'A regra desliga e tudo volta a funcionar como antes, inclusive o Exclusivo/Compartilhado da '
        + 'roleta. Os donos gravados continuam em Canais: ligar de novo não precisa refazer nada.',
      rotuloDaAcao: 'Desligar',
      destrutivo: true,
    };
  }
  const { owned, shared } = data.summary;
  const comDono = owned === 0
    ? 'Nenhum número ganha dono'
    : owned === 1
      ? '1 número com dono claro ganha o dono sugerido gravado'
      : `${owned} números com dono claro ganham o dono sugerido gravado`;
  const semDono = shared === 0
    ? 'nenhum número fica sem dono'
    : shared === 1
      ? 'o número sem dono é da imobiliária e entra na roleta'
      : `os ${shared} números sem dono são da imobiliária e entram na roleta`;
  return {
    titulo: `Ligar dono do número em ${tenantName}?`,
    descricao: `${comDono} (cada dono fica liberado no número dele) e a regra liga: quem escreve no número de um `
      + `corretor vai direto pra ele; ${semDono}. Dá para desligar depois, e os donos ficam gravados.`,
    rotuloDaAcao: 'Ligar',
    destrutivo: false,
  };
}

export function ruleDoneText(kind: RuleActionKind, tenantName: string, data: OwnershipDiagnosis): string {
  if (kind === 'disable') return `Dono do número desligado em ${tenantName}. Os donos continuam gravados em Canais.`;
  const n = data.rule?.last?.changed ?? 0;
  return `Dono do número ligado em ${tenantName}: ${n} ${n === 1 ? 'dono gravado' : 'donos gravados'}.`;
}

/**
 * O motivo da recusa. O painel raiz responde `{ error: 'texto' }` (422 e 500);
 * a recusa por cargo vem como `{ error: { message } }`. Ler só um dos dois faz
 * a outra virar frase genérica — e a frase genérica nunca afirma a causa.
 */
export function ruleErrorMessage(error: unknown): string {
  const corpo = (error as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  const e = corpo?.error;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return RULE_FAILED_MESSAGE;
}

// O caminho para resolver cada conflito, escolhido pelo CÓDIGO do servidor
// (nunca lendo a frase). Código novo sem dica aqui não inventa nada: a frase do
// servidor continua aparecendo sozinha.
const CONFLICT_HINTS: Record<string, string> = {
  responsible_missing: 'Escolha outro Dono do número em Canais, ou deixe sem dono.',
  responsible_vs_roleta: 'Deixe o Dono do número e a roleta apontando para a mesma pessoa.',
  exclusive_no_broker: 'Ponha um corretor no número, na roleta, ou marque-o como compartilhado.',
  exclusive_many_brokers: 'Deixe um corretor só no número, ou marque-o como compartilhado na roleta.',
  exclusive_and_shared: 'Marque o número do mesmo jeito nas duas roletas.',
  exclusive_two_roletas: 'Deixe o mesmo corretor no número nas duas roletas.',
  shared_single_broker: 'Se o número é dele, escolha-o como Dono do número em Canais; se não, ponha mais corretores.',
  responsible_on_shared: 'Tire o Dono do número em Canais (o número segue dividido) ou deixe só ele na roleta.',
  no_roleta_many_liberated: 'Escolha o Dono do número em Canais, ou deixe um corretor só liberado.',
  owner_deactivated: 'Escolha outro Dono do número em Canais, ou deixe sem dono.',
  support_owner: 'Tire a conta da Leal Mídia do Dono do número em Canais.',
};

export function conflictHint(code: string): string {
  return Object.prototype.hasOwnProperty.call(CONFLICT_HINTS, code) ? CONFLICT_HINTS[code] : '';
}
