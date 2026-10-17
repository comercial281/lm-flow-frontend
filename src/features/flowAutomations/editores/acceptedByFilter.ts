import type { LeadAutomationCondition } from '@/services/leadAutomation/leadAutomationService';
import type { User } from '@/types/users';

// "Corretor aceitou o lead" filtrado por QUEM aceitou.
//
// Pedido do dono do produto: o mesmo formulário e a mesma roleta servem todos os
// corretores, mas só alguns têm IA Vendedora no próprio número — e a mensagem de
// abertura só faz sentido para esses. Funil e roleta não separam nada nesse
// desenho; a única coisa que diferencia é quem clicou em Aceitar.
//
// O servidor já manda `assigned_user_id` no contexto do gatilho e compara
// qualquer campo do contexto (`LeadAutomationRule#context_value`), então a
// condição é uma linha comum no array `conditions` — nada novo no backend.
//
// Nenhum marcado = a regra vale para o aceite de QUALQUER corretor (o
// comportamento de antes). Por isso lista vazia vira `null`, e não `in []`:
// `in []` não casaria com ninguém e a regra pararia calada.

export const ACCEPTED_BY_FIELD = 'assigned_user_id';

export const isAcceptedByCondition = (c: LeadAutomationCondition | null | undefined): boolean =>
  c?.field === ACCEPTED_BY_FIELD;

// Ids como string: o seletor trabalha com string e o servidor compara com to_s.
export function acceptedByIds(condition: LeadAutomationCondition | null | undefined): string[] {
  if (!isAcceptedByCondition(condition)) return [];
  const raw = condition!.value;
  const list = Array.isArray(raw) ? raw : (raw === undefined || raw === null || raw === '' ? [] : [raw]);
  return list.map(v => String(v));
}

export function acceptedByCondition(ids: string[]): LeadAutomationCondition | null {
  const unique = Array.from(new Set(ids.map(String)));
  return unique.length ? { field: ACCEPTED_BY_FIELD, operator: 'in', value: unique } : null;
}

export function toggleAcceptedBy(ids: string[], id: string): string[] {
  const key = String(id);
  return ids.includes(key) ? ids.filter(x => x !== key) : [...ids, key];
}

export interface AcceptedByOption {
  id: string;
  name: string;
  // Marcado na regra, mas não está mais na lista de usuários da conta.
  missing: boolean;
  deactivated: boolean;
}

// Quem aparece para marcar: os usuários ativos, e TAMBÉM qualquer um que já está
// marcado — desativado ou fora da conta. Esconder um marcado faria a regra seguir
// filtrando por alguém que a tela não mostra.
export function acceptedByOptions(users: User[], selected: string[]): AcceptedByOption[] {
  const options: AcceptedByOption[] = users
    .filter(u => !u.deactivated || selected.includes(String(u.id)))
    .map(u => ({ id: String(u.id), name: u.name, missing: false, deactivated: !!u.deactivated }));

  const known = new Set(options.map(o => o.id));
  selected
    .filter(id => !known.has(id))
    .forEach(id => options.push({ id, name: `Usuário #${id}`, missing: true, deactivated: false }));

  return options;
}

export function acceptedBySummary(ids: string[], users: User[]): string {
  if (!ids.length) return 'Qualquer corretor que aceitar';
  const names = ids.map(id => {
    const user = users.find(u => String(u.id) === id);
    return user ? user.name : `Usuário #${id} (não está mais na conta)`;
  });
  return `Só quando quem aceitou for: ${names.join(', ')}`;
}
