import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

// Quem atende um número (fase 2, C81). A conversa fala com um NÚMERO, e o número
// pode ser dividido entre agentes: a lista vem dos números do agente (`numbers`),
// na ordem da `position` (o primeiro é o que vale quando ninguém escolhe), e não
// do espelho `inbox_id`, que só guarda o primeiro número do agente.

/** Agente juntado a outro vale como "não existe mais". */
const vivo = (a: SalesAgent) => !a.absorbed_into_id;

function posicaoNoNumero(a: SalesAgent, inboxId: string): number | null {
  const numeros = a.numbers ?? [];
  if (numeros.length === 0) return a.inbox_id === inboxId ? 0 : null;
  const n = numeros.find(x => x.inbox_id === inboxId && x.enabled);
  return n ? n.position : null;
}

/**
 * Os agentes que respondem ao vivo neste número, na ordem do número. Os ligados vêm
 * primeiro; se nenhum está ligado, devolve os desligados (a janela mostra a situação).
 * Agente só de follow-up não entra: nunca responde ao vivo.
 */
export function agentesDoNumero(agents: SalesAgent[], inboxId: string | null | undefined): SalesAgent[] {
  if (!inboxId) return [];
  const doNumero = agents
    .filter(a => vivo(a) && !a.followup_only)
    .map(a => ({ a, pos: posicaoNoNumero(a, String(inboxId)) }))
    .filter((x): x is { a: SalesAgent; pos: number } => x.pos !== null)
    .sort((x, y) => x.pos - y.pos || x.a.name.localeCompare(y.a.name))
    .map(x => x.a);
  const ligados = doNumero.filter(a => a.enabled);
  return ligados.length > 0 ? ligados : doNumero;
}

/** Algum número tem 2 ou mais agentes ligados? Então a escolha do agente faz diferença. */
export function temNumeroDividido(agents: SalesAgent[]): boolean {
  const porNumero = new Map<string, number>();
  for (const a of agents) {
    if (!vivo(a) || a.followup_only || !a.enabled) continue;
    for (const n of a.numbers ?? []) {
      if (n.enabled) porNumero.set(n.inbox_id, (porNumero.get(n.inbox_id) ?? 0) + 1);
    }
  }
  return [...porNumero.values()].some(total => total > 1);
}

/** Os agentes que o bloco "Passar para a IA" pode escolher: vivos e que respondem ao vivo. */
export function agentesParaOBloco(agents: SalesAgent[]): SalesAgent[] {
  return agents.filter(a => vivo(a) && !a.followup_only && a.enabled);
}

export const ESCOLHA_DO_AGENTE = 'Escolha qual agente atende';
