// Frases que resumem a configuração da IA. Onda 3: sobrou a do destino, usada no Testar ("O que aconteceria" antes do primeiro repasse).
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { briefingEnabled } from './handoffBriefing';
import { lerEscolhas } from './tresEscolhas';

export interface ContextoDoResumo {
  numero: string | null;
  roleta?: string | null;
  corretor?: string | null;
}

export function fraseDoObjetivo(agent: SalesAgent, nomes: Omit<ContextoDoResumo, 'numero'> = {}): string {
  const { persona, alcance, destino } = lerEscolhas(agent);
  const faz = alcance === 'visit' ? 'qualifica, marca a visita' : 'qualifica';
  const resumo = briefingEnabled(agent.transfer_config) ? ' com o resumo' : '';
  if (persona === 'broker') {
    const dono = agent.number_owner_name ? ` (${agent.number_owner_name})` : '';
    return `Ela ${faz} e avisa o dono do número${dono}${resumo}.`;
  }
  const pra = destino === 'roleta'
    ? `pra roleta ${nomes.roleta ?? 'escolhida'}`
    : destino === 'user' ? `pra ${nomes.corretor ?? 'o corretor escolhido'}`
      : destino === 'webhook' ? (agent.handoff_webhook_system === 'cvcrm' ? 'pro CVCRM do cliente' : 'pro sistema do cliente')
        : 'pra roleta do número';
  return `Ela ${faz} e entrega ${pra}${resumo}.`;
}
