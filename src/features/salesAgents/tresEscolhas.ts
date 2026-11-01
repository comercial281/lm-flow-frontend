/**
 * As TRÊS ESCOLHAS da IA Vendedora (refatoração, entrega 2): quem ela é, até onde
 * ela vai e pra onde vai o lead.
 *
 * Fonte de verdade no servidor: `persona_kind` e `reach`. Enquanto a coluna estiver
 * vazia o servidor devolve o valor LIDO das antigas (`transfer_config.voice` e
 * `booking_enabled`); a derivação aqui é a rede pra servidor antigo.
 *
 * Desde a Tarefa 71 (01/11/2026) a tela não grava mais persona nem alcance (a ficha de quem
 * fala e o trabalho tomaram o lugar): sobrou só a LEITURA, que a Destino, as pendências e o
 * resumo ainda usam. `personaParaPatch` e `roletaDoNumero` saíram junto com a página Identidade.
 */
import type { AlcanceDaIa, PersonaDaIa, SalesAgent, SalesAgentHandoffTarget } from '@/services/salesAgents/salesAgentsService';
import { speaksAsBroker } from './handoffVoice';

export type HandoffTargetMode = SalesAgentHandoffTarget;

export interface Escolhas {
  persona: PersonaDaIa;
  alcance: AlcanceDaIa;
  destino: HandoffTargetMode;
}

const PERSONAS: PersonaDaIa[] = ['broker', 'owner', 'assistant'];
const ALCANCES: AlcanceDaIa[] = ['qualify', 'visit'];

type Lido = Partial<Pick<SalesAgent, 'persona_kind' | 'reach' | 'transfer_config' | 'booking_enabled' | 'handoff_target'>>;

export function lerEscolhas(agent: Lido): Escolhas {
  const persona = PERSONAS.includes(agent.persona_kind as PersonaDaIa)
    ? (agent.persona_kind as PersonaDaIa)
    : speaksAsBroker(agent.transfer_config) ? 'broker' : 'assistant';
  const alcance = ALCANCES.includes(agent.reach as AlcanceDaIa)
    ? (agent.reach as AlcanceDaIa)
    : agent.booking_enabled === false ? 'qualify' : 'visit';
  return { persona, alcance, destino: agent.handoff_target ?? 'inbox_roleta' };
}
