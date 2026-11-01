/**
 * As TRÊS ESCOLHAS da IA Vendedora (refatoração, entrega 2): quem ela é, até onde
 * ela vai e pra onde vai o lead.
 *
 * Fonte de verdade no servidor: `persona_kind` e `reach`. Enquanto a coluna estiver
 * vazia o servidor devolve o valor LIDO das antigas (`transfer_config.voice` e
 * `booking_enabled`); a derivação aqui é a rede pra servidor antigo.
 *
 * ⚠️ Gravar a persona ESPELHA na voz antiga (`personaParaPatch`), porque o roteiro
 * de hoje só lê a antiga. O servidor faz o mesmo espelho.
 *
 * ⚠️ Persona "o próprio corretor" só passa pro DONO DO NÚMERO (decisão do dono do
 * produto, opção "a"): roleta e corretor fixo ficam travados nela.
 */
import type {
  AlcanceDaIa, PersonaDaIa, PersonaGravavel, SalesAgent, SalesAgentHandoffTarget,
} from '@/services/salesAgents/salesAgentsService';
import type { RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
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

/** A roleta ATIVA ligada ao número da IA (régua da rotina `ia:destino_sem_inbox_roleta`). */
export function roletaDoNumero(
  roletas: Pick<RoletaConfig, 'id' | 'inbox_id' | 'is_active'>[], inboxId: string | null | undefined,
): string | null {
  if (!inboxId) return null;
  const r = roletas.find((x) => String(x.inbox_id) === String(inboxId) && x.is_active !== false);
  return r ? String(r.id) : null;
}

/**
 * Trocar a PERSONA (onda 3). O corretor só passa pro dono do número (decisão de
 * 05/10). Sair dele com o lead indo pro dono vai pra roleta DO NÚMERO — nunca
 * `inbox_roleta`, que a onda 2 recusa em gravação nova; sem roleta no número, a
 * roleta fica vazia e a pendência "Falta escolher a roleta" leva ao Destino.
 * Destino que alguém escolheu (roleta, corretor, sistema do cliente) fica.
 */
export function personaParaPatch(
  persona: PersonaGravavel,
  agent: Pick<SalesAgent, 'transfer_config' | 'handoff_target'>,
  roletaNoNumero: string | null,
): Partial<SalesAgent> {
  const transfer_config = toggleVoice(agent.transfer_config, persona === 'broker');
  if (persona === 'broker') {
    return { persona_kind: 'broker', transfer_config, handoff_target: 'number_owner', handoff_roleta_config_id: null, handoff_user_id: null };
  }
  if (agent.handoff_target === 'number_owner' || agent.handoff_target === 'inbox_roleta') {
    return { persona_kind: persona, transfer_config, handoff_target: 'roleta', handoff_roleta_config_id: roletaNoNumero, handoff_user_id: null };
  }
  return { persona_kind: persona, transfer_config };
}
