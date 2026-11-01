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
 * Trava o Ligar: sem número, a voz Corretor num número sem dono (o servidor
 * também recusa este), o Sistema do cliente sem chave pronta, o CVCRM sem conexão, o
 * Filtra e passa sem pergunta obrigatória, o número de atendimento sem mensagem de
 * chegada e o número dividido sem gatilho (`podeLigar`, que olha os outros agentes). O nome que o lead vê
 * é opcional e não aparece como pendência (11/10/2026): sem ele o roteiro sai igual
 * ao de antes, e as IAs que já atendem não têm esse nome.
 */
import type { AgentNumber, SalesAgent, SalesAgentTrigger } from '@/services/salesAgents/salesAgentsService';
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
  | 'handoff_user_id' | 'handoff_webhook_url' | 'handoff_webhook_secret_state' | 'handoff_webhook_system'
  | 'handoff_cvcrm_connected' | 'lead_facing_name' | 'inbox_id' | 'number_owner_id' | 'qualification_questions'
  | 'trigger_keyword' | 'followup_enabled' | 'followup_action' | 'followup_flow_id' | 'followup_sequence_slug'
  | 'job' | 'next_steps' | 'house_voice' | 'numbers' | 'handoff_continue_at' | 'handoff_service_inbox_id' | 'handoff_arrival_message'>>;

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

export const FRASE_FILTRA_SEM_OBRIGATORIA = 'Filtra e passa precisa de pelo menos uma pergunta obrigatória.';

const textos = (l: unknown): string[] => (Array.isArray(l) ? l : []).map((q) => String(q ?? '').trim()).filter(Boolean);

export function pendenciasDasPaginas(agent: Lido): PendenciaDaPagina[] {
  const lista: PendenciaDaPagina[] = [];
  const { persona } = lerEscolhas(agent);

  if (persona === 'broker' && agent.inbox_id && !agent.number_owner_id) {
    lista.push({ chave: 'persona_sem_dono', pagina: 'numeros', frase: FRASE_SEM_DONO, impedeLigar: true });
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
  const noCvcrm = agent.handoff_target === 'webhook' && agent.handoff_webhook_system === 'cvcrm';
  // CVCRM: endereço e token são da conexão do cliente (Integrações → CVCRM). Sem
  // ela, todo lead que ela passar fica sem ninguém: trava o Ligar.
  if (noCvcrm && agent.handoff_cvcrm_connected === false) {
    lista.push({
      chave: 'destino_cvcrm_desconectado', pagina: 'destino', impedeLigar: true,
      frase: 'O CVCRM deste cliente não está conectado: conecte em Integrações → CVCRM.',
    });
  }
  if (agent.handoff_target === 'webhook' && !noCvcrm && !(agent.handoff_webhook_url ?? '').trim()) {
    lista.push({ chave: 'destino_sem_endereco', pagina: 'destino', frase: 'Falta o endereço do sistema do cliente.', impedeLigar: false });
  }
  // ⚠️ Sem chave pronta, todo lead que ela passar fica sem ninguém (o servidor não
  // envia e só avisa a gestão). Trava o Ligar.
  if (agent.handoff_target === 'webhook' && !noCvcrm && agent.handoff_webhook_secret_state !== 'ready') {
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
    lista.push({ chave: 'perguntas_vazias', pagina: 'conducao', frase: 'Escreva as perguntas que ela faz antes de passar o lead.', impedeLigar: false });
  }
  if (!agent.inbox_id) {
    lista.push({ chave: 'sem_numero', pagina: 'numeros', frase: 'Falta o número de WhatsApp.', impedeLigar: true });
  }
  const palavra = (agent.trigger_keyword ?? '').trim();
  if (palavra) {
    lista.push({ chave: 'palavra_antiga', pagina: 'campanhas', frase: `Ainda vale a regra antiga da palavra "${palavra}".`, impedeLigar: false });
  }
  // Desde 06/10/2026 a IA não escreve mais o follow-up ('ai' é só valor antigo). O
  // aviso de "sem limite de tentativas" saiu junto: entregando o lead ela age uma
  // vez por sumiço, e o campo do teto não existe mais na tela.
  const semEscolha = motivoSemEscolhaDoFollowup(agent);
  if (semEscolha) {
    lista.push({ chave: 'followup_sem_escolha', pagina: 'funil', frase: semEscolha, impedeLigar: false });
  }
  // "Entregar pro follow-up" sem follow-up escolhido: o servidor não tem pra onde
  // entregar. Quem ainda aponta pro funil antigo (só o slug) tem destino e o aviso
  // amarelo próprio na página Follow-up, então não conta aqui.
  if (agent.followup_enabled && agent.followup_action === 'sequence' && !agent.followup_flow_id && !agent.followup_sequence_slug) {
    lista.push({ chave: 'followup_sem_fluxo', pagina: 'funil', frase: 'Falta escolher o follow-up que recebe o lead.', impedeLigar: false });
  }

  // --- Reestruturação (Tarefa 70) ---------------------------------------------
  // Sem `job` gravado, como o servidor (`job_value`): agendar visita é `booking_enabled != false`.
  const job = agent.job ?? (agent.booking_enabled === false ? 'filtra_passa' : 'leva_visita');
  const passos = agent.next_steps ?? (job === 'leva_visita' ? ['visita'] : []);

  // Filtra e passa entrega quando as obrigatórias estão respondidas. Como o servidor,
  // "nenhuma marcada" vale como "todas": só falta mesmo quando não há pergunta nenhuma.
  if (job === 'filtra_passa' && textos(agent.transfer_config?.required_questions).length === 0 && textos(agent.qualification_questions).length === 0) {
    lista.push({ chave: 'filtra_sem_obrigatoria', pagina: 'conducao', frase: FRASE_FILTRA_SEM_OBRIGATORIA, impedeLigar: true });
  }
  if (passos.includes('reuniao') && !(agent.house_voice?.office_address ?? '').trim()) {
    lista.push({
      chave: 'reuniao_sem_endereco', pagina: 'modo', impedeLigar: false,
      frase: 'A reunião no escritório está nos próximos passos, mas falta o endereço do escritório na ficha da casa: ela não é oferecida.',
    });
  }
  // Voz Corretor em número ligado sem dono: a ficha do número, ou a da casa quando ele herda.
  const casaCorretor = agent.house_voice?.kind === 'corretor';
  const semDono = (agent.numbers ?? []).find((n) => n.enabled && (n.voice?.kind ?? (casaCorretor ? 'corretor' : undefined)) === 'corretor' && !n.owner_user_id);
  if (semDono && !lista.some((p) => p.chave === 'persona_sem_dono')) {
    lista.push({
      chave: 'corretor_sem_dono_do_numero', pagina: 'numeros', impedeLigar: true,
      // A frase do servidor (`SalesAgentNumber.missing_owner_message`), palavra por palavra.
      frase: `${semDono.inbox_name ? `O número ${semDono.inbox_name}` : 'Este número'} está com a voz Corretor e não tem corretor dono. Escolha o dono em Integrações → WhatsApp ou use outra voz.`,
    });
  }
  if (agent.handoff_continue_at === 'service_number') {
    if (!(agent.handoff_arrival_message ?? '').trim()) {
      lista.push({ chave: 'continua_sem_mensagem', pagina: 'destino', impedeLigar: true, frase: 'Escreva a mensagem de chegada: é ela que avisa o lead do número novo.' });
    } else if (!agent.handoff_service_inbox_id) {
      // Dado parado (o número de atendimento foi apagado depois): o servidor só confere quando os campos mudam, nunca ao ligar.
      lista.push({ chave: 'continua_sem_mensagem', pagina: 'destino', impedeLigar: false, frase: 'Escolha o número de atendimento onde a conversa continua.' });
    }
  }

  const ordem = (p: PaginaId) => ORDEM_DAS_PAGINAS.indexOf(p);
  return lista.sort((a, b) => ordem(a.pagina) - ordem(b.pagina));
}

export function paginasComPendencia(agent: Lido): Set<PaginaId> {
  return new Set(pendenciasDasPaginas(agent).map((p) => p.pagina));
}

/** O que o `podeLigar` precisa dos OUTROS agentes do cliente (a lista que a casca já tem). */
export type OutroAgente = Pick<SalesAgent, 'id' | 'name' | 'enabled' | 'numbers' | 'triggers' | 'trigger_keyword' | 'trigger_match_mode'>
  & Partial<Pick<SalesAgent, 'absorbed_into_id'>>;
type AgenteQueLiga = Lido & Partial<Pick<SalesAgent, 'id' | 'triggers' | 'trigger_match_mode'>>;

/**
 * Atende todo lead que chega ao número (mesma régua do servidor, `TriggerOverlap.every_lead?`):
 * sem gatilho, ou a origem "todos" valendo sozinha (modo "qualquer um"). Os gatilhos
 * são os do número, ou os do agente quando o número herda (nulo); a palavra antiga
 * conta como gatilho de quem herda.
 */
function atendeTodoLead(agent: Partial<Pick<SalesAgent, 'triggers' | 'trigger_keyword' | 'trigger_match_mode'>>, numero: Pick<AgentNumber, 'triggers'>): boolean {
  const proprios: SalesAgentTrigger[] | null = numero.triggers;
  const lista: SalesAgentTrigger[] = proprios ?? [
    ...(agent.triggers ?? []),
    ...((agent.trigger_keyword ?? '').trim() ? [{ type: 'keyword' as const, value: (agent.trigger_keyword ?? '').trim() }] : []),
  ];
  if (lista.length === 0) return true;
  return agent.trigger_match_mode !== 'all' && lista.some((t) => t.type === 'origin' && t.mode === 'all');
}

/**
 * Ligar o agente. As travas do próprio agente (`impedeLigar`) e a do número dividido:
 * ligar num número que outro agente LIGADO também atende pede gatilho dos dois. Só agente
 * ligado conta (rascunho, desligado e juntado não mudam nada no que está no ar).
 */
export function podeLigar(agent: AgenteQueLiga, outros: OutroAgente[] = []): { pode: boolean; motivo: string | null; pagina: PaginaId | null } {
  const trava = pendenciasDasPaginas(agent).find((p) => p.impedeLigar);
  if (trava) return { pode: false, motivo: trava.frase, pagina: trava.pagina };

  for (const meu of (agent.numbers ?? []).filter((n) => n.enabled)) {
    for (const outro of outros) {
      if (outro.id === agent.id || !outro.enabled || outro.absorbed_into_id) continue;
      const dele = (outro.numbers ?? []).find((n) => n.enabled && n.inbox_id === meu.inbox_id);
      if (!dele) continue;
      if (atendeTodoLead(agent, meu) || atendeTodoLead(outro, dele)) {
        return {
          pode: false, pagina: 'campanhas',
          motivo: `Pra dividir o número ${meu.inbox_name || 'sem nome'} com o agente ${outro.name}, os dois precisam de gatilhos.`,
        };
      }
    }
  }
  return { pode: true, motivo: null, pagina: null };
}
