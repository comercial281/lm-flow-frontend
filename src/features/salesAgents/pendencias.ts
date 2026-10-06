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
 * Trava o Ligar: sem número, a persona corretor num número sem dono (o servidor
 * também recusa este), o Sistema do cliente sem chave pronta e o CVCRM sem conexão. O nome que o lead vê
 * só AVISA (decisão do dono do produto, 05/10): sem ele o roteiro sai igual ao de
 * antes, e as IAs que já atendem não têm esse nome.
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
  | 'handoff_user_id' | 'handoff_webhook_url' | 'handoff_webhook_secret_state' | 'handoff_webhook_system'
  | 'handoff_cvcrm_connected' | 'lead_facing_name' | 'inbox_id' | 'number_owner_id' | 'qualification_questions'
  | 'trigger_keyword' | 'followup_enabled' | 'followup_action' | 'followup_flow_id' | 'followup_sequence_slug'>>;

/**
 * Follow-up ligado sem uma saída válida (06/10/2026): ainda em 'ai' (a IA não
 * escreve mais o follow-up) ou sem valor. O servidor recusa ligar o follow-up
 * assim, então o Salvar do passo 7 não deixa (com esta frase como motivo) e o
 * trilho mostra a pendência. Null = está tudo certo.
 */
export function motivoSemEscolhaDoFollowup(agent: Pick<Lido, 'followup_enabled' | 'followup_action'>): string | null {
  if (!agent.followup_enabled) return null;
  if (agent.followup_action === 'ai') return 'Escolha como o follow-up continua: a IA não escreve mais o follow-up.';
  if (!agent.followup_action) return 'Escolha o que ela faz quando o lead some.';
  return null;
}

export function pendenciasDosPassos(agent: Lido): PendenciaDoPasso[] {
  const lista: PendenciaDoPasso[] = [];
  const { persona } = lerEscolhas(agent);

  if (!(agent.lead_facing_name ?? '').trim()) {
    // Só aviso, não trava o Ligar (decisão do dono do produto, 05/10): vazio, ela se
    // apresenta sem nome, como sempre fez.
    lista.push({ chave: 'nome_visivel', passo: 1, frase: 'Falta o nome que o lead vê.', impedeLigar: false });
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
  const noCvcrm = agent.handoff_target === 'webhook' && agent.handoff_webhook_system === 'cvcrm';
  // CVCRM: endereço e token são da conexão do cliente (Integrações → CVCRM). Sem
  // ela, todo lead que ela passar fica sem ninguém: trava o Ligar.
  if (noCvcrm && agent.handoff_cvcrm_connected === false) {
    lista.push({
      chave: 'destino_cvcrm_desconectado', passo: 2, impedeLigar: true,
      frase: 'O CVCRM deste cliente não está conectado: conecte em Integrações → CVCRM.',
    });
  }
  if (agent.handoff_target === 'webhook' && !noCvcrm && !(agent.handoff_webhook_url ?? '').trim()) {
    lista.push({ chave: 'destino_sem_endereco', passo: 2, frase: 'Falta o endereço do sistema do cliente.', impedeLigar: false });
  }
  // ⚠️ Sem chave pronta, todo lead que ela passar fica sem ninguém (o servidor não
  // envia e só avisa a gestão). Trava o Ligar.
  if (agent.handoff_target === 'webhook' && !noCvcrm && agent.handoff_webhook_secret_state !== 'ready') {
    lista.push({
      chave: 'destino_sem_chave', passo: 2, impedeLigar: true,
      frase: agent.handoff_webhook_secret_state === 'unreadable'
        ? 'A chave secreta do sistema do cliente não abre mais: gere outra.'
        : 'Falta gerar a chave secreta do sistema do cliente.',
    });
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
  // Desde 06/10/2026 a IA não escreve mais o follow-up ('ai' é só valor antigo). O
  // aviso de "sem limite de tentativas" saiu junto: entregando o lead ela age uma
  // vez por sumiço, e o campo do teto não existe mais na tela.
  const semEscolha = motivoSemEscolhaDoFollowup(agent);
  if (semEscolha) {
    lista.push({ chave: 'followup_sem_escolha', passo: 7, frase: semEscolha, impedeLigar: false });
  }
  // "Entregar pro follow-up" sem follow-up escolhido: o servidor não tem pra onde
  // entregar. Quem ainda aponta pro funil antigo (só o slug) tem destino e o aviso
  // amarelo próprio no passo 7, então não conta aqui.
  if (agent.followup_enabled && agent.followup_action === 'sequence' && !agent.followup_flow_id && !agent.followup_sequence_slug) {
    lista.push({ chave: 'followup_sem_fluxo', passo: 7, frase: 'Falta escolher o follow-up que recebe o lead.', impedeLigar: false });
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
