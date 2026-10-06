// O VEREDITO ÚNICO da IA Vendedora: atendendo, parada (com o motivo), atendendo
// com restrição, desligada ou rascunho. Aparece no selo da barra, no seletor de
// IAs e na Visão geral, com o "Corrigir" de cada pendência.
//
// Por que existe: antes, o estado real (sem número, gatilho restringindo, canal
// desconectado) só aparecia na última aba, o Diagnóstico, e a lista mostrava a
// bolinha verde de "Ativa" para uma IA que não atendia ninguém (checklist da fase
// 4, §6). Spec: LM FLOW/specs/2026-10-05-ia-vendedora-refatoracao-design.md.
//
// ⚠️ Leitura SÓ: nada aqui muda o atendimento. As regras espelham o servidor —
// `SalesAgents::TriggerGate` (quem ela atende) e `SalesAgents::HealthCheck` (o
// checklist do Diagnóstico). Mudou lá, muda aqui, com o caso no spec.
import type { HealthItem, HealthReport, SalesAgent, SalesAgentTrigger } from '@/services/salesAgents/salesAgentsService';
import type { PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';
import type { TelaId } from './iaMenu';
import { pendenciasDasPaginas } from './pendencias';

export type TipoSituacao = 'atendendo' | 'parada' | 'restricao' | 'desligada' | 'rascunho';

export interface Corrigir {
  tela: TelaId;
  /** Página do Configurar (onda 3). */
  pagina?: PaginaId;
}

export interface Situacao {
  tipo: TipoSituacao;
  frase: string;
  corrigir?: Corrigir;
}

export interface Pendencia {
  chave: string;
  titulo: string;
  detalhe: string;
  /** Vermelho: ela não atende assim. Laranja: atende, mas provavelmente não do jeito que o gestor espera. */
  grave: boolean;
  corrigir?: Corrigir;
}

type AgenteLido = Pick<SalesAgent, 'enabled' | 'inbox_id' | 'triggers' | 'trigger_keyword' | 'trigger_match_mode'>
  & Partial<Pick<SalesAgent, 'followup_only' | 'followup_enabled' | 'followup_action' | 'followup_flow_id' | 'followup_sequence_slug'
    | 'persona_kind' | 'reach' | 'transfer_config' | 'booking_enabled' | 'handoff_target' | 'handoff_roleta_config_id'
    | 'handoff_user_id' | 'handoff_webhook_url' | 'handoff_webhook_secret_state' | 'lead_facing_name' | 'number_owner_id' | 'qualification_questions'>>;

/** A página do Configurar que corrige cada coisa (onda 3). */
const PAGINA = (pagina: PaginaId): Corrigir => ({ tela: 'configurar', pagina });

// Item do Diagnóstico com erro que PARA a IA, e a frase do selo. Os outros erros
// (base de conhecimento, imóvel padrão) viram pendência, não veredito: ela
// continua respondendo, só pior.
const PARADA_POR_ITEM: Record<string, { frase: string; corrigir?: Corrigir }> = {
  inbox: { frase: 'Parada: o número desta IA não existe mais', corrigir: PAGINA('canal') },
  mode: { frase: 'Parada: está em "só follow-up" e não responde quem escreve', corrigir: PAGINA('canal') },
  // ⚠️ Era a tela Diagnóstico, que saiu do menu (só equipe). O cartão do número, em
  // Canal, mostra se o WhatsApp está conectado.
  credentials: { frase: 'Parada: o WhatsApp do número está desconectado', corrigir: PAGINA('canal') },
  api_key: { frase: 'Parada: problema na plataforma, avise o suporte' },
};

// Onde se corrige cada item do Diagnóstico. Sem entrada = não tem botão (ex.: a
// chave da IA no servidor, que o gestor não controla; e "IA ligada", que liga na
// chave da barra).
const CORRIGIR_DO_ITEM: Record<string, Corrigir> = {
  mode: PAGINA('canal'),
  inbox: PAGINA('canal'),
  traffic: PAGINA('canal'),
  activity: PAGINA('canal'),
  credentials: PAGINA('canal'),
  knowledge: { tela: 'ensinar' },
  files: { tela: 'ensinar' },
  handoff: PAGINA('destino'),
  default_property: PAGINA('catalogo'),
  schedule: PAGINA('horario'),
  triggers: PAGINA('canal'),
  conflict: PAGINA('canal'),
  client_system: PAGINA('destino'),
};

/** Os gatilhos que o servidor de fato avalia: a lista + a palavra-chave antiga, se a lista não tiver gatilho de palavra. */
function gatilhosEfetivos(agent: AgenteLido): SalesAgentTrigger[] {
  const lista = (agent.triggers ?? []).filter((t) => t && t.type);
  const palavra = (agent.trigger_keyword ?? '').trim();
  if (palavra && !lista.some((t) => t.type === 'keyword')) return [...lista, { type: 'keyword', value: palavra }];
  return lista;
}

/** Gatilho que nunca bate (palavra, etiqueta ou código em branco, formulário ou coluna sem escolha). */
function emBranco(t: SalesAgentTrigger): boolean {
  switch (t.type) {
    case 'keyword':
    case 'tag':
      return !(t.value ?? '').trim();
    case 'property':
      return t.mode === 'code' && !(t.code ?? '').trim();
    case 'form':
      return !(t.form_ids ?? []).length;
    case 'pipeline_stage':
      return !t.stage_id;
    default:
      return false;
  }
}

function descricao(t: SalesAgentTrigger): string {
  switch (t.type) {
    case 'keyword':
      return t.match_type === 'equals' ? `quem escrever só "${(t.value ?? '').trim()}"` : `quem escrever "${(t.value ?? '').trim()}"`;
    case 'origin':
      return 'lead de anúncio';
    case 'form':
      return (t.form_ids ?? []).length === 1 ? 'lead do formulário escolhido' : 'lead dos formulários escolhidos';
    case 'property':
      return t.mode === 'code' ? `lead do imóvel ${(t.code ?? '').trim().toUpperCase()}` : 'lead que veio de um imóvel';
    case 'pipeline':
      return t.pipeline_id ? 'lead de um funil escolhido' : 'quem tem card no funil';
    case 'pipeline_stage':
      return 'lead numa coluna escolhida do funil';
    case 'tag':
      return `quem tem a etiqueta "${(t.value ?? '').trim()}"`;
    default:
      return 'lead que bate num gatilho';
  }
}

function juntar(partes: string[], conector: 'ou' | 'e'): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} ${conector} ${partes[partes.length - 1]}`;
}

/**
 * Quem ela atende, em português, ou null quando atende todo lead do número.
 * `parada` é true quando os gatilhos não deixam ninguém passar.
 */
export function restricaoDosGatilhos(agent: AgenteLido): { frase: string; parada: boolean } | null {
  const todos = gatilhosEfetivos(agent);
  if (todos.length === 0) return null;
  const modo = agent.trigger_match_mode === 'all' ? 'all' : 'any';

  if (modo === 'any') {
    // "Origem: todos os leads" bate sempre: com OU, ninguém fica de fora.
    if (todos.some((t) => t.type === 'origin' && t.mode === 'all')) return null;
    const validos = todos.filter((t) => !emBranco(t));
    if (validos.length === 0) return { frase: 'os gatilhos estão em branco e não deixam ninguém passar', parada: true };
    return { frase: `só ${juntar(validos.map(descricao), 'ou')}`, parada: false };
  }

  if (todos.some(emBranco)) return { frase: 'um gatilho está em branco e não deixa ninguém passar', parada: true };
  const restritivos = todos.filter((t) => !(t.type === 'origin' && t.mode === 'all'));
  if (restritivos.length === 0) return null;
  return { frase: `só ${juntar(restritivos.map(descricao), 'e')}`, parada: false };
}

export function situacaoDaIa(agent: AgenteLido, diagnostics?: HealthReport | null): Situacao {
  if (!agent.enabled && !agent.inbox_id) return { tipo: 'rascunho', frase: 'Rascunho: falta escolher o número', corrigir: PAGINA('canal') };
  // Desligada: sem botão, liga na chave da barra.
  if (!agent.enabled) return { tipo: 'desligada', frase: 'Desligada' };
  if (!agent.inbox_id) return { tipo: 'parada', frase: 'Parada: falta o número', corrigir: PAGINA('canal') };
  if (agent.followup_only) return { tipo: 'parada', ...PARADA_POR_ITEM.mode };

  const erro = (diagnostics?.items ?? []).find((i) => i.status === 'error' && PARADA_POR_ITEM[i.key]);
  if (erro) return { tipo: 'parada', ...PARADA_POR_ITEM[erro.key] };

  const restricao = restricaoDosGatilhos(agent);
  if (restricao?.parada) return { tipo: 'parada', frase: `Parada: ${restricao.frase}`, corrigir: PAGINA('canal') };
  if (restricao) return { tipo: 'restricao', frase: `Atendendo com restrição: ${restricao.frase}`, corrigir: PAGINA('canal') };

  return { tipo: 'atendendo', frase: 'Atendendo' };
}

function daItem(item: HealthItem): Pendencia {
  return {
    chave: item.key,
    titulo: item.label,
    detalhe: item.detail,
    grave: item.status === 'error',
    corrigir: CORRIGIR_DO_ITEM[item.key],
  };
}

/**
 * O que falta, na ordem de gravidade, pra Visão geral. Vem do Diagnóstico
 * (sem os itens em dia) mais o que a tela sabe sozinha: gatilho restringindo
 * (o servidor marca verde) e o follow-up sem saída válida (ainda na opção antiga
 * "A IA escreve", sem escolha, ou "Entregar pro follow-up" sem follow-up).
 */
const TITULO_NO_PAINEL: Record<string, string> = {
  persona_sem_dono: 'Dono do número',
  persona_destino: 'Pra onde vai o lead',
  destino_antigo: 'Pra onde vai o lead',
  destino_sem_roleta: 'Pra onde vai o lead',
  destino_sem_corretor: 'Pra onde vai o lead',
  destino_sem_endereco: 'Pra onde vai o lead',
  destino_sem_chave: 'Chave do sistema do cliente',
  perguntas_vazias: 'Perguntas antes de passar',
  followup_sem_escolha: 'O que ela faz quando o lead some',
  followup_sem_fluxo: 'O que ela faz quando o lead some',
};

export function pendenciasDaIa(agent: AgenteLido, diagnostics?: HealthReport | null): Pendencia[] {
  // "IA ligada" desligada já é o veredito; repetir na lista é ruído.
  const lista = (diagnostics?.items ?? []).filter((i) => i.status !== 'ok' && i.key !== 'enabled').map(daItem);

  if (!diagnostics && agent.enabled && !agent.inbox_id) {
    lista.push({ chave: 'inbox', titulo: 'Número de WhatsApp', detalhe: 'Nenhum número escolhido. Sem ele a IA não recebe nem responde ninguém.', grave: true, corrigir: PAGINA('canal') });
  }

  const restricao = restricaoDosGatilhos(agent);
  if (restricao && !lista.some((p) => p.chave === 'triggers')) {
    lista.push({
      chave: 'triggers',
      titulo: 'Quem ela atende',
      detalhe: `${restricao.frase.charAt(0).toUpperCase()}${restricao.frase.slice(1)}.`,
      grave: restricao.parada,
      corrigir: PAGINA('canal'),
    });
  }

  // Entrega 2: o que só a configuração sabe (persona e destino), com a página que
  // corrige. É aqui que aparece a IA antiga que fala como o corretor e entrega pra
  // um corretor fixo que não é o dono do número. O nome que o lead vê não entra no
  // Painel (é pendência de Identidade e trava o Ligar, mas não para quem já atende).
  for (const p of pendenciasDasPaginas(agent)) {
    const titulo = TITULO_NO_PAINEL[p.chave];
    if (!titulo || lista.some((x) => x.chave === p.chave)) continue;
    lista.push({ chave: p.chave, titulo, detalhe: p.frase, grave: p.impedeLigar, corrigir: PAGINA(p.pagina) });
  }

  return [...lista.filter((p) => p.grave), ...lista.filter((p) => !p.grave)];
}

/**
 * Por que a Visão geral está sem números, quando a IA não está atendendo. Null
 * quando ela atende (com ou sem restrição): aí o zero é só falta de movimento.
 */
export function motivoSemAtendimento(situacao: Situacao): string | null {
  if (situacao.tipo === 'parada') return situacao.frase.replace(/^Parada: /, '');
  if (situacao.tipo === 'desligada') return 'ela está desligada';
  if (situacao.tipo === 'rascunho') return 'ela ainda é um rascunho, sem número';
  return null;
}
