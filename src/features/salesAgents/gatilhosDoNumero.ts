/**
 * Os gatilhos de UM número do agente (fase 2). Dois valores parecidos que NÃO são o mesmo:
 * `null` = o número herda os gatilhos do agente; `[]` = o número atende todo lead. Voltar pra
 * "Os do agente" grava nulo: gravar `[]` ali trocaria "os do agente" por "todo lead" sem ninguém ver.
 */
import type { AgentNumber, SalesAgentTrigger } from '@/services/salesAgents/salesAgentsService';

export type EstadoDosGatilhos = 'do_agente' | 'todo_lead' | 'proprios';

export function estadoDosGatilhos(numero: Pick<AgentNumber, 'triggers'>): EstadoDosGatilhos {
  if (numero.triggers === null || numero.triggers === undefined) return 'do_agente';
  return numero.triggers.length === 0 ? 'todo_lead' : 'proprios';
}

/**
 * O que gravar no número ao escolher o estado. `atuais` são os gatilhos próprios que ele tem agora.
 * "Só alguns" sem nenhum gatilho devolve `[]`: quem chama não grava (a condição nasce na tela e só
 * vai pro servidor quando fica completa).
 */
export function gatilhosDoEstado(estado: EstadoDosGatilhos, atuais: SalesAgentTrigger[] | null): SalesAgentTrigger[] | null {
  if (estado === 'do_agente') return null;
  if (estado === 'todo_lead') return [];
  return atuais ?? [];
}
