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
import type { TelaId } from './iaMenu';

export type TipoSituacao = 'atendendo' | 'parada' | 'restricao' | 'desligada' | 'rascunho';

export interface Corrigir {
  tela: TelaId;
  /** Passo do passo a passo (entrega 2). Na entrega 1, Configurar é a página antiga inteira. */
  passo?: number;
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
  & Partial<Pick<SalesAgent, 'followup_only' | 'followup_enabled' | 'followup_max_attempts'>>;

const CONFIGURAR: Corrigir = { tela: 'configurar' };

// Item do Diagnóstico com erro que PARA a IA, e a frase do selo. Os outros erros
// (base de conhecimento, imóvel padrão) viram pendência, não veredito: ela
// continua respondendo, só pior.
const PARADA_POR_ITEM: Record<string, { frase: string; corrigir?: Corrigir }> = {
  inbox: { frase: 'Parada: o número desta IA não existe mais', corrigir: CONFIGURAR },
  mode: { frase: 'Parada: está em "só follow-up" e não responde quem escreve', corrigir: CONFIGURAR },
  credentials: { frase: 'Parada: o WhatsApp do número está desconectado', corrigir: { tela: 'diagnostico' } },
  api_key: { frase: 'Parada: problema na plataforma, avise o suporte' },
};

// Onde se corrige cada item do Diagnóstico. Sem entrada = não tem botão (ex.: a
// chave da IA no servidor, que o gestor não controla).
const CORRIGIR_DO_ITEM: Record<string, Corrigir> = {
  enabled: CONFIGURAR,
  mode: CONFIGURAR,
  inbox: CONFIGURAR,
  traffic: CONFIGURAR,
  activity: { tela: 'diagnostico' },
  credentials: { tela: 'diagnostico' },
  knowledge: { tela: 'ensinar' },
  files: { tela: 'ensinar' },
  handoff: CONFIGURAR,
  default_property: CONFIGURAR,
  schedule: CONFIGURAR,
  triggers: CONFIGURAR,
  conflict: CONFIGURAR,
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
  if (!agent.enabled && !agent.inbox_id) return { tipo: 'rascunho', frase: 'Rascunho: falta escolher o número', corrigir: CONFIGURAR };
  if (!agent.enabled) return { tipo: 'desligada', frase: 'Desligada', corrigir: CONFIGURAR };
  if (!agent.inbox_id) return { tipo: 'parada', frase: 'Parada: falta o número', corrigir: CONFIGURAR };
  if (agent.followup_only) return { tipo: 'parada', ...PARADA_POR_ITEM.mode };

  const erro = (diagnostics?.items ?? []).find((i) => i.status === 'error' && PARADA_POR_ITEM[i.key]);
  if (erro) return { tipo: 'parada', ...PARADA_POR_ITEM[erro.key] };

  const restricao = restricaoDosGatilhos(agent);
  if (restricao?.parada) return { tipo: 'parada', frase: `Parada: ${restricao.frase}`, corrigir: CONFIGURAR };
  if (restricao) return { tipo: 'restricao', frase: `Atendendo com restrição: ${restricao.frase}`, corrigir: CONFIGURAR };

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
 * (o servidor marca verde) e follow-up sem limite de tentativas.
 */
export function pendenciasDaIa(agent: AgenteLido, diagnostics?: HealthReport | null): Pendencia[] {
  // "IA ligada" desligada já é o veredito; repetir na lista é ruído.
  const lista = (diagnostics?.items ?? []).filter((i) => i.status !== 'ok' && i.key !== 'enabled').map(daItem);

  if (!diagnostics && agent.enabled && !agent.inbox_id) {
    lista.push({ chave: 'inbox', titulo: 'Número de WhatsApp', detalhe: 'Nenhum número escolhido. Sem ele a IA não recebe nem responde ninguém.', grave: true, corrigir: CONFIGURAR });
  }

  const restricao = restricaoDosGatilhos(agent);
  if (restricao && !lista.some((p) => p.chave === 'triggers')) {
    lista.push({
      chave: 'triggers',
      titulo: 'Quem ela atende',
      detalhe: `${restricao.frase.charAt(0).toUpperCase()}${restricao.frase.slice(1)}.`,
      grave: restricao.parada,
      corrigir: CONFIGURAR,
    });
  }

  if (agent.followup_enabled && agent.followup_max_attempts === 0) {
    lista.push({
      chave: 'followup_sem_limite',
      titulo: 'Follow-up sem limite de tentativas',
      detalhe: 'Ela volta a chamar quem sumiu sem parar. Defina um máximo de tentativas no Follow-up automático.',
      grave: false,
      corrigir: CONFIGURAR,
    });
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
