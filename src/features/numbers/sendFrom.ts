// "ENVIAR PELO NÚMERO" (fase 2b.2) — por qual número de WhatsApp sai a
// mensagem automática: a ação *Enviar mensagem WhatsApp* das Automações de
// Lead e cada funil de Follow-up. Quem DECIDE é o servidor (Numbers::SendFrom:
// a ordem da spec, o aviso ao salvar); aqui ficam o formato do valor, a linha
// de cada número e as palavras — fora do JSX, com spec.
//
// Cada tela tem o seu padrão (E37): na automação é o de sempre ("Automático");
// no funil, o número do responsável pelo lead — e por isso ali não existe a
// opção "responsável" à parte ('owner' gravado vale o mesmo que o padrão).
//
// Textos LITERAIS de propósito: chave nova de t() não entra. Linguagem:
// "número", nunca instância, inbox ou caixa de entrada (há spec). Neutro de
// gênero (F8 do pré-voo): nunca "ele"/"dele" para a pessoa responsável —
// "se houver mais de um", "o responsável pelo lead atende".

import type { NumberConnection, NumberOwnerRef } from './types';
import { connectionLabel, formatPhone } from './numberTexts';

/** '' = o padrão da tela (automação: o de sempre; funil: o responsável). */
export type SendFromMode = '' | 'owner' | 'number';
export type SendNumbersScope = 'lead_automation_rules' | 'followup_sequences';
export type SendNumbersState = 'loading' | 'loaded' | 'failed';

export interface SendFromValue {
  send_from: SendFromMode;
  send_from_inbox_id: string;
}

/** Um número que a configuração pode escolher (só os que enviam sozinhos). */
export interface SendNumberOption {
  inbox_id: string;
  name: string;
  phone: string | null;
  connection: NumberConnection;
  /** Dono EFETIVO — só vem com a regra do dono ligada no cliente. */
  owner: NumberOwnerRef | null;
}

export interface SendNumbers {
  number_owner_rule: boolean;
  numbers: SendNumberOption[];
}

export const SEND_FROM_LABEL = 'Enviar pelo número';
export const SEND_FROM_AUTO = 'Automático (como sempre foi)';
export const SEND_FROM_FOLLOWUP_DEFAULT = 'O número do responsável pelo lead (padrão)';
export const SEND_FROM_OWNER = 'O número do responsável pelo lead';
export const SEND_FROM_SPECIFIC_GROUP = 'Um número específico';
export const SEND_FROM_NEEDS_NUMBER = 'Escolha o número em "Enviar pelo número".';
export const SEND_FROM_LOAD_FAILED = 'Não consegui carregar os números agora. Salvar mantém a escolha que já estava.';
export const SEND_FROM_KEEPS_CONVERSATION =
  'Se o lead já conversa num número em que o responsável pelo lead atende, a conversa continua nele.';
/** Quanto tempo o aviso do salvar fica na tela (E33). */
export const SEND_FROM_WARNING_MS = 10000;

const HINTS: Record<SendFromMode, string> = {
  '': 'Sai pelo número da conversa do lead; lead sem conversa sai pelo número que o sistema escolher.',
  owner:
    'Sai pelo número do responsável pelo lead (o principal, se houver mais de um). ' +
    `Lead sem responsável sai como no automático. ${SEND_FROM_KEEPS_CONVERSATION}`,
  number: `Sai sempre por este número. ${SEND_FROM_KEEPS_CONVERSATION}`,
};

const FOLLOWUP_DEFAULT_HINT =
  'Sai pelo número do responsável pelo lead (o principal, se houver mais de um). ' +
  `${SEND_FROM_KEEPS_CONVERSATION} ` +
  'Lead sem responsável, ou responsável sem número, sai como antes: pelo número da conversa do lead.';

const NUMBER_PREFIX = 'number:';
const AUTO: SendFromValue = { send_from: '', send_from_inbox_id: '' };

export function sendFromAutoLabel(scope: SendNumbersScope): string {
  return scope === 'followup_sequences' ? SEND_FROM_FOLLOWUP_DEFAULT : SEND_FROM_AUTO;
}

export function showsOwnerOption(scope: SendNumbersScope): boolean {
  return scope !== 'followup_sequences';
}

export function sendFromHint(mode: SendFromMode, scope: SendNumbersScope = 'lead_automation_rules'): string {
  if (scope === 'followup_sequences' && mode !== 'number') return FOLLOWUP_DEFAULT_HINT;
  return HINTS[mode] ?? HINTS[''];
}

/** No funil, 'owner' gravado É o padrão (E37): a tela mostra como padrão. */
export function valueForScope(v: SendFromValue, scope: SendNumbersScope): SendFromValue {
  return scope === 'followup_sequences' && v.send_from === 'owner' ? { ...AUTO } : v;
}

/** O valor gravado (params da ação ou o funil), normalizado. Lixo = padrão. */
export function sendFromOf(
  source: { send_from?: unknown; send_from_inbox_id?: unknown } | null | undefined,
): SendFromValue {
  const mode = String(source?.send_from ?? '').trim();
  if (mode === 'owner') return { send_from: 'owner', send_from_inbox_id: '' };
  if (mode === 'number') return { send_from: 'number', send_from_inbox_id: String(source?.send_from_inbox_id ?? '').trim() };
  return { ...AUTO };
}

export function selectValue(v: SendFromValue): string {
  if (v.send_from === 'owner') return 'owner';
  if (v.send_from === 'number' && v.send_from_inbox_id) return `${NUMBER_PREFIX}${v.send_from_inbox_id}`;
  return '';
}

export function fromSelectValue(raw: string): SendFromValue {
  if (raw === 'owner') return { send_from: 'owner', send_from_inbox_id: '' };
  if (raw.startsWith(NUMBER_PREFIX) && raw.length > NUMBER_PREFIX.length) {
    return { send_from: 'number', send_from_inbox_id: raw.slice(NUMBER_PREFIX.length) };
  }
  return { ...AUTO };
}

/**
 * Os params da ação com a escolha nova. Escolher um número (ou o do
 * responsável) TIRA a "Instância de envio (admin)": o servidor já a ignora com
 * escolha feita (E26), e deixá-la gravada faria o campo reaparecer no
 * automático com um valor que ninguém escolheu de novo.
 */
export function applySendFrom<T extends Record<string, unknown>>(params: T, v: SendFromValue): T {
  const next: Record<string, unknown> = { ...params, send_from: v.send_from, send_from_inbox_id: v.send_from_inbox_id };
  if (v.send_from) delete next.sender_instance;
  return next as T;
}

export function sendFromProblem(v: SendFromValue): string | null {
  return v.send_from === 'number' && !v.send_from_inbox_id ? SEND_FROM_NEEDS_NUMBER : null;
}

/** "Loja · (11) 91234-1234 · desconectado · de Ana". */
export function numberOptionLabel(n: SendNumberOption, ownerRule: boolean): string {
  const partes = [n.name];
  const fone = formatPhone(n.phone);
  if (fone) partes.push(fone);
  if (n.connection !== 'connected') partes.push(connectionLabel(n.connection));
  if (ownerRule && n.owner) partes.push(`de ${n.owner.name}`);
  return partes.join(' · ');
}

/** O número gravado não está na lista (apagado, ou a lista ainda não veio). */
export function missingSelection(v: SendFromValue, numbers: SendNumberOption[]): boolean {
  return v.send_from === 'number' && Boolean(v.send_from_inbox_id) && !numbers.some(n => n.inbox_id === v.send_from_inbox_id);
}

export function missingSelectionLabel(state: SendNumbersState): string {
  if (state === 'loading') return 'Carregando os números…';
  if (state === 'failed') return 'O número escolhido antes (a lista não carregou)';
  return 'Número que não existe mais — escolha outro';
}

export function sendNumbersFrom(data: Partial<SendNumbers> | null | undefined): SendNumbers {
  return {
    number_owner_rule: data?.number_owner_rule === true,
    numbers: Array.isArray(data?.numbers) ? (data!.numbers as SendNumberOption[]) : [],
  };
}

/** Os avisos que o servidor devolve no salvar (E33). */
export function sendFromWarnings(saved: { send_from_warnings?: unknown } | null | undefined): string[] {
  const lista = saved?.send_from_warnings;
  return Array.isArray(lista) ? lista.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [];
}
