// DONO DO NÚMERO (fase 2b.1) — os textos e as regras de exibição, fora do JSX.
//
// Mora aqui porque é a promessa que a tela faz ("quem escreve neste número vai
// direto pro dono") e ela precisa de spec: dita num cliente sem a regra, ou com
// o dono errado, a tela mente. O servidor DECIDE (dono efetivo, principal,
// recusa); aqui só se escolhe a palavra.
//
// Textos LITERAIS de propósito: chave nova de t() não entra (o conferir-i18n só
// aceita trocar o valor de chave que já existe). Linguagem: "número", nunca
// instância, inbox ou caixa de entrada (há spec). Neutro de gênero (E10/G2):
// "Número de Fulano", "é de Fulano", "o cadastro de Fulano está desativado".

import type { NumberConnection, NumberCardData, NumberOwnerRef, OwnedNumber } from './types';

export const OWNER_TITLE = 'Dono do número';
export const OWNER_EXPLANATION =
  'Quem escreve neste número vai direto pro dono. Sem dono, o número é da imobiliária e quem escreve entra na roleta.';
export const SHARED_LABEL = 'Da imobiliária (compartilhado)';
export const NUMBERS_TITLE = 'Números de atendimento';
export const NUMBERS_COLUMN = 'Números';
export const LIBERATED_TITLE = 'Números liberados';
export const PRINCIPAL = 'Principal';
export const MAKE_PRIMARY = 'Tornar principal';
export const CHANGE_IN_CHANNELS = 'alterar em Canais';
export const NOTICE_PHONE_LABEL = 'Celular para avisos';
export const PRIMARY_HINT_SELF =
  'O principal só desempata: é o número que o sistema usa quando precisa escolher um dos seus.';
export const PRIMARY_HINT_OTHER =
  'O principal só desempata: é o número que o sistema usa quando precisa escolher um dos números da pessoa.';
export const NO_OWNED_NUMBERS_SELF =
  'Nenhum número de WhatsApp é seu ainda. Quem define o dono de um número é o gestor, em Canais.';
export const NO_OWNED_NUMBERS_OTHER =
  'Nenhum número de WhatsApp é desta pessoa. O dono de cada número se define em Canais.';
export const MY_NUMBERS_DESCRIPTION = 'Os números de WhatsApp que são seus: quem escreve neles vai direto pra você.';
export const PRIMARY_DONE = 'Número principal atualizado.';
export const PRIMARY_FAILED = 'Não consegui trocar o número principal.';
export const NO_PHONE = 'sem telefone gravado';
export const NO_ROLETA = 'em nenhuma roleta';
export const NO_AI = 'nenhuma IA atende aqui';
export const CONNECTION_NOTE = 'Conexão pelo último estado gravado.';

/**
 * (11) 91234-1234. L3: o que começa com `+` e cujos dígitos não começam com
 * `55` volta exatamente como veio (nunca lido como BR sem o 55) — ex.:
 * `+14155552671`. O que não parece telefone brasileiro também volta cru.
 */
export function formatPhone(phone: string | null | undefined): string {
  const bruto = (phone ?? '').trim();
  if (!bruto) return '';
  const rawDigits = bruto.replace(/\D/g, '');
  if (bruto.startsWith('+') && !rawDigits.startsWith('55')) return bruto;
  let digits = rawDigits;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return bruto;
  const ddd = digits.slice(0, 2);
  const resto = digits.slice(2);
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * L8: única implementação — a aba Números do painel raiz (`connectionText`
 * em `numberOwnershipRules.ts`) delega para esta função. Não duplicar.
 */
export function connectionLabel(connection: NumberConnection): string {
  switch (connection) {
    case 'connected':
      return 'conectado';
    case 'connecting':
      return 'conectando';
    case 'disconnected':
      return 'desconectado';
    default:
      return 'sem estado gravado';
  }
}

/**
 * De quem é o número, no cartão de Canais. Com a regra, o dono GRAVADO que não
 * vale (desativado, ou conta da Leal Mídia) aparece com o motivo — o número
 * vale como da imobiliária. Sem a regra, só o nome gravado: o campo ainda não
 * decide nada ali, e a tela não pode prometer que decide.
 *
 * G2: dono desativado usa "o cadastro de Fulano está desativado" (neutro de
 * gênero — nem "está desativado" sozinho nem "Fulano está desativada").
 */
export function ownerLine(card: Pick<NumberCardData, 'owner' | 'shared' | 'number_owner_rule'>): string {
  const { owner } = card;
  if (!card.number_owner_rule) return owner ? owner.name : 'ninguém';
  if (!owner) return SHARED_LABEL;
  if (!owner.active) return `${SHARED_LABEL} — o cadastro de ${owner.name} está desativado`;
  if (card.shared) return `${SHARED_LABEL} — ${owner.name} é conta da Leal Mídia`;
  return owner.name;
}

/** O que acontece com quem escreve no número (Canais e Roleta). */
export function numberRuleLine(owner: NumberOwnerRef | null): string {
  if (!owner) return 'Número da imobiliária: quem escreve entra na roleta';
  return `Número de ${owner.name}: quem escreve nele vai direto pra ${owner.name}`;
}

/** Embaixo do número travado, na Roleta. */
export function ownerLockText(ownerName: string): string {
  return `Este número é de ${ownerName}. Pra dividir, tire o dono em Canais.`;
}

/** Na lista de "por que não salva" da Roleta — a MESMA frase da recusa do servidor. */
export function ownerLockProblem(numberLabel: string, ownerName: string): string {
  return `Este número (${numberLabel}) é de ${ownerName}. Pra dividir, tire o dono em Canais.`;
}

export function ownedNumberLine(n: OwnedNumber): string {
  const rotulo = formatPhone(n.phone) || n.name;
  return n.principal ? `${rotulo} · ${PRINCIPAL}` : rotulo;
}

export interface LiberatedCounts {
  sees_all_inboxes: boolean;
  granted_inbox_ids: string[];
  auto_inbox_ids: string[];
}

/** "1 liberado · 2 automáticos": as duas origens de acesso, separadas. */
export function liberatedSummary(m: LiberatedCounts): string {
  if (m.sees_all_inboxes) return 'Todos';
  const liberados = m.granted_inbox_ids.length;
  const automaticos = m.auto_inbox_ids.length;
  if (liberados === 0 && automaticos === 0) return 'Nenhum';
  const partes: string[] = [];
  if (liberados > 0) partes.push(`${liberados} liberado${liberados > 1 ? 's' : ''}`);
  if (automaticos > 0) partes.push(`${automaticos} automático${automaticos > 1 ? 's' : ''}`);
  return partes.join(' · ');
}

/**
 * A coluna da Equipe (spec: "Números: (11) 9xxxx-1234 · Principal"). Com a
 * regra e número próprio, o principal (e quantos mais); sem a regra, ou para
 * quem não é dono de número nenhum, os liberados — que é o que continua
 * decidindo onde essa pessoa atende.
 */
export function numbersColumnText(m: LiberatedCounts & { numbers?: OwnedNumber[] }, rule: boolean): string {
  const proprios = m.numbers ?? [];
  if (rule && proprios.length > 0) {
    const principal = proprios.find(n => n.principal) ?? proprios[0];
    const mais = proprios.length - 1;
    return mais > 0 ? `${ownedNumberLine(principal)} (+${mais})` : ownedNumberLine(principal);
  }
  return liberatedSummary(m);
}

/**
 * Com a regra, o dono do número está SEMPRE entre os colaboradores (o servidor
 * não o deixa sair). A tela manda a lista com ele — senão desmarcar "salva", e
 * ele volta marcado no recarregamento, calado.
 */
export function withOwner(ids: string[], ownerId: string | null): string[] {
  if (!ownerId || ids.includes(ownerId)) return ids;
  return [...ids, ownerId];
}

/**
 * Quem fica TRAVADO em Colaboradores (não sai da lista, ganha o selo *Dono do
 * número*): só o dono EFETIVO — o mesmo que o servidor protege (E1: gravado,
 * ativo, e não é conta da Leal Mídia). Conta da Leal Mídia ou desativado
 * gravado como dono PODE ser desmarcado: travar ali prometeria uma trava que
 * o servidor não faz.
 *
 * Sem cartão (ainda carregando, ou canal fora de Canais), mantém o
 * comportamento CONSERVADOR: trava pelo gravado — é o mesmo travamento de
 * antes desta task, para não piscar destravado enquanto o cartão não chegou.
 */
export function lockedOwnerId(
  ownerUserId: string | null,
  rule: boolean,
  card: Pick<NumberCardData, 'owner' | 'shared'> | null | undefined,
): string | null {
  if (!rule || !ownerUserId) return null;
  if (!card) return String(ownerUserId);
  const efetivo = Boolean(card.owner && card.owner.active && !card.shared);
  return efetivo ? String(ownerUserId) : null;
}
