/**
 * As TRÊS ESCOLHAS da IA Vendedora (refatoração, entrega 2): quem ela é, até onde
 * ela vai e pra onde vai o lead.
 *
 * Fonte de verdade no servidor: `persona_kind` e `reach`. Enquanto a coluna estiver
 * vazia o servidor devolve o valor LIDO das antigas (`transfer_config.voice` e
 * `booking_enabled`); a derivação aqui é a rede pra servidor antigo.
 *
 * ⚠️ Gravar uma escolha ESPELHA nas antigas (voz e agendar visita), porque o roteiro
 * de hoje só lê as antigas. O servidor faz o mesmo espelho; aqui é pro rascunho da
 * tela não mentir antes do Salvar.
 *
 * ⚠️ Persona "o próprio corretor" só passa pro DONO DO NÚMERO (decisão do dono do
 * produto, opção "a"): roleta e corretor fixo ficam travados nela.
 */
import type {
  AlcanceDaIa, PersonaDaIa, SalesAgent, SalesAgentHandoffTarget, SalesAgentPayload,
} from '@/services/salesAgents/salesAgentsService';
import { speaksAsBroker, toggleVoice } from './handoffVoice';

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

type Base = Pick<SalesAgent, 'transfer_config' | 'handoff_roleta_config_id' | 'handoff_user_id'>;

/**
 * Roleta nova (06/10/2026): "a roleta do número" não existe mais — o servidor
 * recusa gravar `inbox_roleta`. O padrão vira "Uma roleta" em branco, e o passo
 * Objetivo pede a escolha.
 */
export function escolhasParaPatch(escolhas: Escolhas, agent: Base): Partial<SalesAgent> {
  const comum: Partial<SalesAgent> = {
    persona_kind: escolhas.persona,
    reach: escolhas.alcance,
    booking_enabled: escolhas.alcance === 'visit',
    transfer_config: toggleVoice(agent.transfer_config, escolhas.persona === 'broker'),
  };
  if (escolhas.persona === 'broker') {
    return { ...comum, handoff_target: 'number_owner', handoff_roleta_config_id: null, handoff_user_id: null };
  }
  // Fora da persona corretor, "o dono do número" não vale (o servidor o recusa
  // em outra persona), e "a roleta do número" (valor antigo) também não: os dois
  // viram "Uma roleta", em branco quando não havia roleta escolhida.
  const destino: HandoffTargetMode =
    escolhas.destino === 'number_owner' || escolhas.destino === 'inbox_roleta' ? 'roleta' : escolhas.destino;
  return {
    ...comum,
    handoff_target: destino,
    handoff_roleta_config_id: destino === 'roleta' ? agent.handoff_roleta_config_id ?? null : null,
    handoff_user_id: destino === 'user' ? agent.handoff_user_id ?? null : null,
  };
}

/**
 * O modelo de partida da IA nova. As quatro perguntas são o BANT de antes dito em
 * português (ninguém usava o bloco BANT; as perguntas obrigatórias antes de passar
 * são o que mais funciona hoje), e já nascem obrigatórias no cenário recomendado.
 */
export const PERGUNTAS_SUGERIDAS = [
  'Qual faixa de investimento você tem em mente?',
  'A decisão é só sua ou mais alguém participa?',
  'O que está fazendo você procurar um imóvel agora?',
  'Em quanto tempo pretende se mudar ou fechar negócio?',
];

/**
 * "Nova IA" cria um RASCUNHO desligado e sem número (é o que a Visão geral chama de
 * rascunho) e abre o passo 1. Substitui o "+" que criava a IA calada e abria o
 * assistente. Aviso fora do horário ligado (o lead de madrugada não fica no vácuo).
 * O `followup_max_attempts: 3` é sobra inofensiva: desde 06/10/2026 a IA não
 * escreve o follow-up, só entrega o lead, e o servidor ignora o teto fora de 'ai'.
 *
 * Sem `followup_action` de propósito (06/10/2026): o servidor dá à IA nova
 * "Entregar pro follow-up" apontando pro Follow-up padrão do cliente (ou "Mover o
 * card", se ele não existir). Mandar daqui seria uma segunda verdade.
 */
export function novaIaRascunho(): SalesAgentPayload {
  return {
    name: 'Nova IA',
    enabled: false,
    mode: 'seller',
    inbox_id: null,
    persona_kind: 'assistant',
    reach: 'qualify',
    booking_enabled: false,
    handoff_target: 'roleta',
    qualification_questions: [...PERGUNTAS_SUGERIDAS],
    transfer_config: { mode: 'checklist', required_questions: [...PERGUNTAS_SUGERIDAS] },
    followup_max_attempts: 3,
    out_of_hours_reply: true,
  };
}
