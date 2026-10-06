/**
 * O que falta em cada PASSO do passo a passo da IA (entrega 2). Serve pra três
 * coisas: o trilho marca o passo com pendência, a tela abre direto no primeiro
 * passo pendente (`passoComPendencia`) e o Ligar do passo 8 trava no que impede
 * atender (`podeLigar`).
 *
 * ⚠️ Não confundir com `pendenciasDaIa` (situacao.ts, entrega 1): aquela é a lista
 * do Painel, que junta o Diagnóstico do servidor. A Visão geral recebe daqui só o
 * que ela não sabe sozinha (persona e destino) — ver situacao.ts.
 *
 * Trava o Ligar: sem número, sem o nome que o lead vê (decisão do índice, 05/10) e a
 * persona corretor num número sem dono (o servidor também recusa este).
 */
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from './tresEscolhas';

export interface PendenciaDoPasso {
  chave: string;
  passo: number;
  frase: string;
  impedeLigar: boolean;
}

export const FRASE_SEM_DONO = 'Este número não tem corretor dono. Escolha o dono em Integrações → WhatsApp ou use outra persona.';

type Lido = Partial<Pick<SalesAgent,
  'persona_kind' | 'reach' | 'transfer_config' | 'booking_enabled' | 'handoff_target' | 'handoff_roleta_config_id'
  | 'handoff_user_id' | 'lead_facing_name' | 'inbox_id' | 'number_owner_id' | 'qualification_questions'
  | 'trigger_keyword' | 'followup_enabled' | 'followup_max_attempts'>>;

export function pendenciasDosPassos(agent: Lido): PendenciaDoPasso[] {
  const lista: PendenciaDoPasso[] = [];
  const { persona } = lerEscolhas(agent);

  if (!(agent.lead_facing_name ?? '').trim()) {
    // Obrigatório pra LIGAR (decisão do índice, 05/10). Não trava quem já está ligada:
    // desligar nunca trava, e salvar o resto continua livre.
    lista.push({ chave: 'nome_visivel', passo: 1, frase: 'Falta o nome que o lead vê.', impedeLigar: true });
  }
  if (persona === 'broker' && agent.inbox_id && !agent.number_owner_id) {
    lista.push({ chave: 'persona_sem_dono', passo: 1, frase: FRASE_SEM_DONO, impedeLigar: true });
  }
  if (persona === 'broker' && agent.handoff_target !== 'number_owner') {
    lista.push({
      chave: 'persona_destino', passo: 2, impedeLigar: false,
      frase: 'Ela fala como o próprio corretor, mas o lead vai para outra pessoa e não para o dono do número. Revise pra onde vai o lead.',
    });
  }
  if (agent.handoff_target === 'roleta' && !agent.handoff_roleta_config_id) {
    lista.push({ chave: 'destino_sem_roleta', passo: 2, frase: 'Falta escolher a roleta que recebe o lead.', impedeLigar: false });
  }
  if (agent.handoff_target === 'user' && !agent.handoff_user_id) {
    lista.push({ chave: 'destino_sem_corretor', passo: 2, frase: 'Falta escolher o corretor que recebe o lead.', impedeLigar: false });
  }
  if (agent.transfer_config?.mode === 'checklist' && !(agent.qualification_questions ?? []).some((q) => (q ?? '').trim())) {
    lista.push({ chave: 'perguntas_vazias', passo: 3, frase: 'Escreva as perguntas que ela faz antes de passar o lead.', impedeLigar: false });
  }
  if (!agent.inbox_id) {
    lista.push({ chave: 'sem_numero', passo: 6, frase: 'Falta o número de WhatsApp.', impedeLigar: true });
  }
  const palavra = (agent.trigger_keyword ?? '').trim();
  if (palavra) {
    lista.push({ chave: 'palavra_antiga', passo: 6, frase: `Ela só entra quando o lead escreve "${palavra}" (regra antiga).`, impedeLigar: false });
  }
  if (agent.followup_enabled && agent.followup_max_attempts === 0) {
    lista.push({ chave: 'followup_sem_limite', passo: 7, frase: 'Follow-up sem limite de tentativas.', impedeLigar: false });
  }

  return lista.sort((a, b) => a.passo - b.passo);
}

export function passoComPendencia(agent: Lido): number | null {
  return pendenciasDosPassos(agent)[0]?.passo ?? null;
}

export function podeLigar(agent: Lido): { pode: boolean; motivo: string | null } {
  const trava = pendenciasDosPassos(agent).find((p) => p.impedeLigar);
  return { pode: !trava, motivo: trava?.frase ?? null };
}
