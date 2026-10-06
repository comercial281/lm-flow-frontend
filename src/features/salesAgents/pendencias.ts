/**
 * O que falta em cada PÁGINA do Configurar da IA (onda 3). Serve pra três
 * coisas: o trilho marca a página com pendência, a tela abre direto na primeira
 * página pendente (`paginaInicial`) e a chave Ligada da barra trava no que impede
 * atender (`podeLigar`).
 *
 * ⚠️ Não confundir com `pendenciasDaIa` (situacao.ts, entrega 1): aquela é a lista
 * do Painel, que junta o Diagnóstico do servidor. A Visão geral recebe daqui só o
 * que ela não sabe sozinha (persona e destino) — ver situacao.ts.
 *
 * Trava o Ligar: sem número, a persona corretor num número sem dono (o servidor
 * também recusa este) e o Sistema do cliente sem chave pronta. O nome que o lead vê
 * só AVISA (decisão do dono do produto, 05/10): sem ele o roteiro sai igual ao de
 * antes, e as IAs que já atendem não têm esse nome.
 */
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { ORDEM_DAS_PAGINAS, type PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';
import { lerEscolhas } from './tresEscolhas';

export interface PendenciaDaPagina {
  chave: string;
  pagina: PaginaId;
  frase: string;
  impedeLigar: boolean;
}

export const FRASE_SEM_DONO = 'Este número não tem corretor dono. Escolha o dono em Integrações → WhatsApp ou use outra persona.';

type Lido = Partial<Pick<SalesAgent,
  'persona_kind' | 'reach' | 'transfer_config' | 'booking_enabled' | 'handoff_target' | 'handoff_roleta_config_id'
  | 'handoff_user_id' | 'handoff_webhook_url' | 'handoff_webhook_secret_state' | 'lead_facing_name' | 'inbox_id' | 'number_owner_id' | 'qualification_questions'
  | 'trigger_keyword' | 'followup_enabled' | 'followup_action' | 'followup_flow_id' | 'followup_sequence_slug'>>;

/**
 * Follow-up ligado sem uma saída válida (06/10/2026): ainda em 'ai' (a IA não
 * escreve mais o follow-up) ou sem valor. O servidor recusa ligar o follow-up
 * assim, então a página Follow-up não deixa (com esta frase como motivo) e o
 * trilho mostra a pendência. Null = está tudo certo.
 */
export function motivoSemEscolhaDoFollowup(agent: Pick<Lido, 'followup_enabled' | 'followup_action'>): string | null {
  if (!agent.followup_enabled) return null;
  if (agent.followup_action === 'ai') return 'Escolha como o follow-up continua: a IA não escreve mais o follow-up.';
  if (!agent.followup_action) return 'Escolha o que ela faz quando o lead some.';
  return null;
}

export function pendenciasDasPaginas(agent: Lido): PendenciaDaPagina[] {
  const lista: PendenciaDaPagina[] = [];
  const { persona } = lerEscolhas(agent);

  if (!(agent.lead_facing_name ?? '').trim()) {
    // Só aviso, não trava o Ligar (decisão do dono do produto, 05/10): vazio, ela se
    // apresenta sem nome, como sempre fez.
    lista.push({ chave: 'nome_visivel', pagina: 'identidade', frase: 'Falta o nome que o lead vê.', impedeLigar: false });
  }
  if (persona === 'broker' && agent.inbox_id && !agent.number_owner_id) {
    lista.push({ chave: 'persona_sem_dono', pagina: 'identidade', frase: FRASE_SEM_DONO, impedeLigar: true });
  }
  if (persona === 'broker' && agent.handoff_target !== 'number_owner') {
    lista.push({
      chave: 'persona_destino', pagina: 'destino', impedeLigar: false,
      frase: 'Ela fala como o próprio corretor, mas o lead vai para outra pessoa e não para o dono do número. Revise pra onde vai o lead.',
    });
  }
  if (agent.handoff_target === 'roleta' && !agent.handoff_roleta_config_id) {
    lista.push({ chave: 'destino_sem_roleta', pagina: 'destino', frase: 'Falta escolher a roleta que recebe o lead.', impedeLigar: false });
  }
  if (agent.handoff_target === 'webhook' && !(agent.handoff_webhook_url ?? '').trim()) {
    lista.push({ chave: 'destino_sem_endereco', pagina: 'destino', frase: 'Falta o endereço do sistema do cliente.', impedeLigar: false });
  }
  // ⚠️ Sem chave pronta, todo lead que ela passar fica sem ninguém (o servidor não
  // envia e só avisa a gestão). Trava o Ligar.
  if (agent.handoff_target === 'webhook' && agent.handoff_webhook_secret_state !== 'ready') {
    lista.push({
      chave: 'destino_sem_chave', pagina: 'destino', impedeLigar: true,
      frase: agent.handoff_webhook_secret_state === 'unreadable'
        ? 'A chave secreta do sistema do cliente não abre mais: gere outra.'
        : 'Falta gerar a chave secreta do sistema do cliente.',
    });
  }
  if (agent.handoff_target === 'user' && !agent.handoff_user_id) {
    lista.push({ chave: 'destino_sem_corretor', pagina: 'destino', frase: 'Falta escolher o corretor que recebe o lead.', impedeLigar: false });
  }
  // "A roleta deste número" saiu da tela (onda 2). A rotina troca as IAs antigas;
  // a que ficou (número sem roleta) continua entregando assim até alguém escolher.
  if (agent.handoff_target === 'inbox_roleta' && persona !== 'broker') {
    lista.push({
      chave: 'destino_antigo', pagina: 'destino', impedeLigar: false,
      frase: 'Hoje o lead vai pra roleta deste número, uma opção que saiu da tela. Escolha a roleta, o corretor ou o sistema do cliente.',
    });
  }
  if (agent.transfer_config?.mode === 'checklist' && !(agent.qualification_questions ?? []).some((q) => (q ?? '').trim())) {
    lista.push({ chave: 'perguntas_vazias', pagina: 'qualificacao', frase: 'Escreva as perguntas que ela faz antes de passar o lead.', impedeLigar: false });
  }
  if (!agent.inbox_id) {
    lista.push({ chave: 'sem_numero', pagina: 'canal', frase: 'Falta o número de WhatsApp.', impedeLigar: true });
  }
  const palavra = (agent.trigger_keyword ?? '').trim();
  if (palavra) {
    lista.push({ chave: 'palavra_antiga', pagina: 'canal', frase: `Ela só entra quando o lead escreve "${palavra}" (regra antiga).`, impedeLigar: false });
  }
  // Desde 06/10/2026 a IA não escreve mais o follow-up ('ai' é só valor antigo). O
  // aviso de "sem limite de tentativas" saiu junto: entregando o lead ela age uma
  // vez por sumiço, e o campo do teto não existe mais na tela.
  const semEscolha = motivoSemEscolhaDoFollowup(agent);
  if (semEscolha) {
    lista.push({ chave: 'followup_sem_escolha', pagina: 'followup', frase: semEscolha, impedeLigar: false });
  }
  // "Entregar pro follow-up" sem follow-up escolhido: o servidor não tem pra onde
  // entregar. Quem ainda aponta pro funil antigo (só o slug) tem destino e o aviso
  // amarelo próprio na página Follow-up, então não conta aqui.
  if (agent.followup_enabled && agent.followup_action === 'sequence' && !agent.followup_flow_id && !agent.followup_sequence_slug) {
    lista.push({ chave: 'followup_sem_fluxo', pagina: 'followup', frase: 'Falta escolher o follow-up que recebe o lead.', impedeLigar: false });
  }

  const ordem = (p: PaginaId) => ORDEM_DAS_PAGINAS.indexOf(p);
  return lista.sort((a, b) => ordem(a.pagina) - ordem(b.pagina));
}

export function paginasComPendencia(agent: Lido): Set<PaginaId> {
  return new Set(pendenciasDasPaginas(agent).map((p) => p.pagina));
}

export function podeLigar(agent: Lido): { pode: boolean; motivo: string | null; pagina: PaginaId | null } {
  const trava = pendenciasDasPaginas(agent).find((p) => p.impedeLigar);
  return { pode: !trava, motivo: trava?.frase ?? null, pagina: trava?.pagina ?? null };
}
