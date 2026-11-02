import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

// Quem atende cada número é regra do servidor (`GET /sales_agents?inbox_id=`, na ordem do
// número). Aqui só ficam as contas do bloco "Passar para a IA" quando o fluxo não fala por
// um número específico e a tela olha o cliente inteiro.

/** Os agentes que o bloco pode escolher: vivos, ligados e que respondem ao vivo. */
export function agentesParaOBloco(agents: SalesAgent[]): SalesAgent[] {
  return agents.filter(a => !a.absorbed_into_id && !a.followup_only && a.enabled);
}

/** Algum número tem 2 ou mais agentes ligados? Então a escolha do agente faz diferença. */
export function temNumeroDividido(agents: SalesAgent[]): boolean {
  const porNumero = new Map<string, number>();
  for (const a of agentesParaOBloco(agents)) {
    for (const n of a.numbers ?? []) {
      if (n.enabled) porNumero.set(n.inbox_id, (porNumero.get(n.inbox_id) ?? 0) + 1);
    }
  }
  return [...porNumero.values()].some(total => total > 1);
}
