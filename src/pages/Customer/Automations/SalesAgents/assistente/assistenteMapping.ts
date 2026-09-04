/**
 * O assistente de configuração da IA Vendedora: respostas ↔ campos da IA.
 *
 * Duas funções PURAS, sem React e sem rede, de propósito — é aqui que mora a
 * regra "o que vira gravação", e ela precisa de teste sem montar a tela:
 *
 * - `answersFromAgent`  abre o assistente PREENCHIDO com o que já está gravado.
 * - `payloadFromAnswers` monta o ÚNICO PATCH do "Concluir".
 *
 * Doutrina da gravação (decisão do dono, 2026-09-04: "grava direto nos campos"):
 *
 * 1. **Só viaja o que MUDOU.** Campo igual ao que a IA já tem não entra no PATCH.
 *    Numa IA recém-criada isso quer dizer que campo deixado em branco NÃO é gravado
 *    — vazio herda o padrão, nunca "desliga".
 * 2. **Apagar de propósito é gravação.** Quem abre uma IA já configurada e limpa
 *    a saudação quer a saudação fora: aí vai `null`.
 * 3. **O `playbook` vai INTEIRO**, mesclado por cima do que já existe. Mandar só
 *    `vars` apagaria os blocos reescritos na seção *Roteiro da conversa*.
 * 4. **Tipo de venda `lancamento` e próximo passo `visita` não são gravados**: são o
 *    padrão de fábrica, e gravar o padrão faria a tela mostrar "escolhido" onde nada
 *    foi escolhido. Mesma regra da seção *Roteiro da conversa*.
 * 5. **Objeção pela metade é descartada** — o servidor faria o mesmo, mas descartar
 *    aqui é o que faz a Revisão mostrar exatamente o que vai ser gravado.
 */
import type {
  ActiveHours,
  AgentPlaybook,
  AgentPlaybookConfig,
  AiLimits,
  HandoffMode,
  IntentQuestionMode,
  PlaybookObjection,
  PlaybookVars,
  SalesAgent,
  SalesAgentFollowupAction,
  SalesAgentPayload,
  TransferConfig,
  VisitConfig,
} from '@/services/salesAgents/salesAgentsService';
import type { ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { DEFAULT_WINDOW } from '@/components/schedule/scheduleWindows';
import { janelaDoFollowup } from '@/features/salesAgents/followupHours';

export const TIPO_VENDA_PADRAO = 'lancamento';
export const PROXIMO_PASSO_PADRAO = 'visita';
export const FUSO = 'America/Sao_Paulo';

/**
 * Como a IA chama o que a imobiliária vende, por tipo de venda. É o bloco
 * `vocabulary` do roteiro, que no servidor é só o termo — e o servidor já escolhe
 * pelo tipo. Só gravamos o termo quando a pessoa escreveu um DIFERENTE do padrão
 * do tipo escolhido; igual ao padrão, a chave sai e o servidor decide.
 *
 * ⚠️ Tem que bater com o servidor (`VOCABULARY_BY_SALE_TYPE`).
 */
export const VOCABULARIO_POR_TIPO: Record<string, string> = {
  lancamento: 'EMPREENDIMENTO',
  usado: 'IMÓVEL',
  loteamento: 'LOTE',
  locacao: 'IMÓVEL',
  misto: 'IMÓVEL',
};

export const VISITA_DIAS_PADRAO = [1, 2, 3, 4, 5];
export const VISITA_INICIO_PADRAO = '09:00';
export const VISITA_FIM_PADRAO = '18:00';

export interface AssistenteAnswers {
  // 1. Quem é a IA
  nome_ia: string;
  nome_imobiliaria: string;
  o_que_vende: string;
  tom: string;
  usa_giria: boolean;
  usa_emoji: boolean;
  audio_enabled: boolean;
  diferenciais: string;
  prova_social: string;
  persona_role: string;
  persona_goal: string;
  instructions: string;
  greeting: string;

  // 2. O que vocês vendem
  tipo_venda: string;
  termo_imovel: string;
  locacao_enabled: boolean;

  // 3. O rumo da conversa
  intent_question_mode: IntentQuestionMode;
  intent_question: string;
  perguntas_situacao: string[];
  qualification_questions: string[];
  dor_tipica: string;
  lead_pronto: string;
  proximo_passo: string;
  visita_dias: number[];
  visita_inicio: string;
  visita_fim: string;
  objecoes: PlaybookObjection[];

  // 4. Limites
  limite_endereco: boolean;
  limite_desconto: boolean;
  limite_preco: boolean;
  limite_iptu: boolean;
  limites_livres: string[];
  escalate_on_frustration: boolean;
  escalate_on_human_request: boolean;
  escalate_on_ai_detected: boolean;

  // 5. Operação
  atuacao_sempre: boolean;
  atuacao_janelas: ScheduleWindow[];
  handoff_mode: HandoffMode | '';
  min_temperature: 'hot' | 'warm';
  followup_enabled: boolean;
  followup_min_days: number;
  followup_max_days: number;
  followup_max_attempts: number;
  followup_action: SalesAgentFollowupAction;
  followup_stage_id: string;
  followup_return_stage_id: string;
  followup_sequence_slug: string;
  followup_janelas: ScheduleWindow[];
  pipeline_move_enabled: boolean;
  pipeline_id: string;
  pipeline_stage_map: Record<string, string>;
}

const linhas = (lista: unknown): string[] =>
  Array.isArray(lista) ? lista.map((l) => String(l ?? '').trim()).filter(Boolean) : [];

const paresCompletos = (lista: unknown): PlaybookObjection[] =>
  Array.isArray(lista)
    ? lista
        .map((o) => ({
          objecao: String((o as PlaybookObjection)?.objecao ?? '').trim(),
          resposta: String((o as PlaybookObjection)?.resposta ?? '').trim(),
        }))
        .filter((o) => o.objecao && o.resposta)
    : [];

const varsDoPlaybook = (agent: SalesAgent, playbook?: AgentPlaybook | null): PlaybookVars => {
  const doEndpoint = playbook?.vars;
  if (doEndpoint && typeof doEndpoint === 'object') return doEndpoint;
  const doAgente = agent.playbook?.vars;
  return doAgente && typeof doAgente === 'object' ? (doAgente as PlaybookVars) : {};
};

const modoDaPergunta = (agent: SalesAgent, playbook?: AgentPlaybook | null): IntentQuestionMode => {
  const doEndpoint = playbook?.intent_question_mode;
  if (doEndpoint === 'always' || doEndpoint === 'opening_only' || doEndpoint === 'never') return doEndpoint;
  const doAgente = agent.playbook?.intent_question_mode;
  if (doAgente === 'opening_only' || doAgente === 'never') return doAgente;
  return 'always';
};

/**
 * Abre o assistente com o que a IA já tem. Campo que a IA nunca teve vem em
 * branco (ou no padrão de fábrica, quando o padrão é o que a tela mostra).
 */
export function answersFromAgent(agent: SalesAgent, playbook?: AgentPlaybook | null): AssistenteAnswers {
  const vars = varsDoPlaybook(agent, playbook);
  const tipo = vars.tipo_venda || TIPO_VENDA_PADRAO;
  const vocabularioGravado = agent.playbook?.vocabulary;
  const limites: AiLimits = agent.ai_limits ?? {};
  const transfer: TransferConfig = agent.transfer_config ?? {};
  const hours: ActiveHours = agent.active_hours ?? {};
  const visita: VisitConfig = agent.visit_config ?? {};

  return {
    nome_ia: agent.name ?? '',
    nome_imobiliaria: '',
    o_que_vende: '',
    tom: '',
    usa_giria: false,
    usa_emoji: false,
    audio_enabled: agent.audio_enabled === true,
    diferenciais: '',
    prova_social: agent.social_proof ?? '',
    persona_role: agent.persona_role ?? '',
    persona_goal: agent.persona_goal ?? '',
    instructions: agent.instructions ?? '',
    greeting: agent.greeting ?? '',

    tipo_venda: tipo,
    termo_imovel: typeof vocabularioGravado === 'string' && vocabularioGravado.trim()
      ? vocabularioGravado.trim()
      : (VOCABULARIO_POR_TIPO[tipo] ?? ''),
    locacao_enabled: agent.locacao_enabled !== false,

    intent_question_mode: modoDaPergunta(agent, playbook),
    intent_question: agent.intent_question ?? '',
    perguntas_situacao: linhas(vars.perguntas_situacao),
    qualification_questions: linhas(agent.qualification_questions),
    dor_tipica: vars.dor_tipica ?? '',
    lead_pronto: vars.lead_pronto ?? '',
    proximo_passo: vars.proximo_passo || PROXIMO_PASSO_PADRAO,
    visita_dias: Array.isArray(visita.days) ? visita.days : [...VISITA_DIAS_PADRAO],
    visita_inicio: visita.start ?? VISITA_INICIO_PADRAO,
    visita_fim: visita.end ?? VISITA_FIM_PADRAO,
    objecoes: paresCompletos(vars.objecoes),

    limite_endereco: !!limites.address,
    limite_desconto: !!limites.discount,
    limite_preco: !!limites.price,
    limite_iptu: !!limites.iptu,
    limites_livres: linhas(limites.custom),
    escalate_on_frustration: agent.escalate_on_frustration !== false,
    escalate_on_human_request: agent.escalate_on_human_request !== false,
    escalate_on_ai_detected: agent.escalate_on_ai_detected !== false,

    atuacao_sempre: (hours.mode ?? 'always') === 'always',
    atuacao_janelas: hours.windows?.length ? (hours.windows as ScheduleWindow[]) : [{ ...DEFAULT_WINDOW }],
    handoff_mode: transfer.mode ?? '',
    min_temperature: transfer.min_temperature ?? 'hot',
    followup_enabled: agent.followup_enabled === true,
    followup_min_days: agent.followup_min_days ?? 2,
    followup_max_days: agent.followup_max_days ?? 3,
    followup_max_attempts: agent.followup_max_attempts ?? 3,
    followup_action: agent.followup_action ?? 'ai',
    followup_stage_id: agent.followup_stage_id ?? '',
    followup_return_stage_id: agent.followup_return_stage_id ?? '',
    followup_sequence_slug: agent.followup_sequence_slug ?? '',
    followup_janelas: janelaDoFollowup(agent),
    pipeline_move_enabled: agent.pipeline_move_enabled === true,
    pipeline_id: agent.pipeline_id ?? '',
    pipeline_stage_map: { ...(agent.pipeline_stage_map ?? {}) },
  };
}

const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Texto livre: igual ao gravado não viaja; vazio onde havia algo vira `null`
 * (apagar de propósito); o resto viaja limpo.
 */
const texto = (valor: string, atual: string | null | undefined): string | null | undefined => {
  const limpo = (valor ?? '').trim();
  const gravado = (atual ?? '').trim();
  if (limpo === gravado) return undefined;
  return limpo === '' ? null : limpo;
};

/**
 * Quando a pessoa respondeu sobre a imobiliária mas não escreveu (nem pediu à IA)
 * as instruções, o que ela contou não pode se perder: vira o texto das
 * Instruções, em prosa simples. É rede, não redação — quem quer texto bonito
 * clica em *Redigir com IA* na própria etapa.
 */
export function instrucoesDeReserva(a: AssistenteAnswers): string {
  const partes: string[] = [];
  if (a.nome_imobiliaria.trim()) partes.push(`Você atende pela ${a.nome_imobiliaria.trim()}.`);
  if (a.o_que_vende.trim()) partes.push(`O que vendemos: ${a.o_que_vende.trim()}.`);
  if (a.tom.trim()) partes.push(`Tom de voz: ${a.tom.trim()}.`);
  const estilo: string[] = [];
  if (a.usa_giria) estilo.push('pode usar gíria leve');
  if (a.usa_emoji) estilo.push('pode usar emoji com moderação');
  if (estilo.length) partes.push(`Estilo: ${estilo.join(', ')}.`);
  if (a.diferenciais.trim()) partes.push(`Nossos diferenciais: ${a.diferenciais.trim()}.`);
  return partes.join('\n');
}

/** Os pontos-chave limpos, no formato que o servidor grava. Vazio = herda tudo. */
export function varsDasRespostas(a: AssistenteAnswers): PlaybookVars {
  const vars: PlaybookVars = {};
  if (a.tipo_venda && a.tipo_venda !== TIPO_VENDA_PADRAO) vars.tipo_venda = a.tipo_venda;
  if (a.proximo_passo && a.proximo_passo !== PROXIMO_PASSO_PADRAO) vars.proximo_passo = a.proximo_passo;
  const perguntas = linhas(a.perguntas_situacao);
  if (perguntas.length) vars.perguntas_situacao = perguntas;
  if (a.dor_tipica.trim()) vars.dor_tipica = a.dor_tipica.trim();
  if (a.lead_pronto.trim()) vars.lead_pronto = a.lead_pronto.trim();
  const objecoes = paresCompletos(a.objecoes);
  if (objecoes.length) vars.objecoes = objecoes;
  return vars;
}

/**
 * O `playbook` inteiro, mesclado por cima do que a IA já tem. Só o que o
 * assistente governa é trocado: modo da pergunta, termo do imóvel e pontos-chave.
 * Bloco reescrito na seção *Roteiro da conversa* atravessa intacto.
 */
export function playbookDasRespostas(a: AssistenteAnswers, atual: AgentPlaybookConfig | undefined): AgentPlaybookConfig {
  const next: AgentPlaybookConfig = { ...(atual ?? {}) };

  if (a.intent_question_mode && a.intent_question_mode !== 'always') next.intent_question_mode = a.intent_question_mode;
  else delete next.intent_question_mode;

  const termo = a.termo_imovel.trim().toUpperCase();
  const padraoDoTipo = VOCABULARIO_POR_TIPO[a.tipo_venda || TIPO_VENDA_PADRAO] ?? '';
  if (termo && termo !== padraoDoTipo) next.vocabulary = termo;
  else delete next.vocabulary;

  const vars = varsDasRespostas(a);
  if (Object.keys(vars).length) next.vars = vars;
  else delete next.vars;

  return next;
}

/**
 * O PATCH do "Concluir". Objeto vazio = nada mudou, e a tela não chama o servidor.
 */
export function payloadFromAnswers(a: AssistenteAnswers, agent: SalesAgent): Partial<SalesAgentPayload> {
  const p: Partial<SalesAgentPayload> = {};

  // 1. Quem é a IA
  const nome = a.nome_ia.trim();
  if (nome && nome !== (agent.name ?? '').trim()) p.name = nome;

  const personaRole = texto(a.persona_role, agent.persona_role);
  if (personaRole !== undefined) p.persona_role = personaRole;
  const personaGoal = texto(a.persona_goal, agent.persona_goal);
  if (personaGoal !== undefined) p.persona_goal = personaGoal;

  const instrucoes = a.instructions.trim() ? a.instructions : instrucoesDeReserva(a);
  const instructions = texto(instrucoes, agent.instructions);
  if (instructions !== undefined) p.instructions = instructions;

  const greeting = texto(a.greeting, agent.greeting);
  if (greeting !== undefined) p.greeting = greeting;
  const social = texto(a.prova_social, agent.social_proof);
  if (social !== undefined) p.social_proof = social;
  if (a.audio_enabled !== (agent.audio_enabled === true)) p.audio_enabled = a.audio_enabled;

  // 2. O que vocês vendem
  if (a.locacao_enabled !== (agent.locacao_enabled !== false)) p.locacao_enabled = a.locacao_enabled;

  // 3. O rumo da conversa
  const intent = texto(a.intent_question, agent.intent_question);
  if (intent !== undefined) p.intent_question = intent;

  const perguntas = linhas(a.qualification_questions);
  if (!iguais(perguntas, linhas(agent.qualification_questions))) p.qualification_questions = perguntas;

  const visitaAtual: VisitConfig = agent.visit_config ?? {};
  const visita: VisitConfig = {
    ...visitaAtual,
    days: [...a.visita_dias].sort((x, y) => x - y),
    start: a.visita_inicio || VISITA_INICIO_PADRAO,
    end: a.visita_fim || VISITA_FIM_PADRAO,
  };
  const visitaComparavel: VisitConfig = {
    ...visitaAtual,
    days: [...(visitaAtual.days ?? VISITA_DIAS_PADRAO)].sort((x, y) => x - y),
    start: visitaAtual.start ?? VISITA_INICIO_PADRAO,
    end: visitaAtual.end ?? VISITA_FIM_PADRAO,
  };
  if (!iguais(visita, visitaComparavel)) p.visit_config = visita;

  // 4. Limites
  const limitesAtuais: AiLimits = agent.ai_limits ?? {};
  const limites: AiLimits = {
    ...limitesAtuais,
    address: a.limite_endereco,
    discount: a.limite_desconto,
    price: a.limite_preco,
    iptu: a.limite_iptu,
    custom: linhas(a.limites_livres),
  };
  const limitesComparaveis: AiLimits = {
    ...limitesAtuais,
    address: !!limitesAtuais.address,
    discount: !!limitesAtuais.discount,
    price: !!limitesAtuais.price,
    iptu: !!limitesAtuais.iptu,
    custom: linhas(limitesAtuais.custom),
  };
  if (!iguais(limites, limitesComparaveis)) p.ai_limits = limites;

  if (a.escalate_on_frustration !== (agent.escalate_on_frustration !== false)) p.escalate_on_frustration = a.escalate_on_frustration;
  if (a.escalate_on_human_request !== (agent.escalate_on_human_request !== false)) p.escalate_on_human_request = a.escalate_on_human_request;
  if (a.escalate_on_ai_detected !== (agent.escalate_on_ai_detected !== false)) p.escalate_on_ai_detected = a.escalate_on_ai_detected;

  // 5. Operação
  const hoursAtual: ActiveHours = agent.active_hours ?? {};
  const hours: ActiveHours = a.atuacao_sempre
    ? { ...hoursAtual, tz: hoursAtual.tz ?? FUSO, mode: 'always' }
    : { ...hoursAtual, tz: hoursAtual.tz ?? FUSO, mode: 'custom', windows: a.atuacao_janelas };
  const hoursComparavel: ActiveHours = { ...hoursAtual, tz: hoursAtual.tz ?? FUSO, mode: hoursAtual.mode ?? 'always' };
  if (!iguais(hours, hoursComparavel)) p.active_hours = hours;

  const transferAtual: TransferConfig = agent.transfer_config ?? {};
  const transfer: TransferConfig = a.handoff_mode === ''
    ? {}
    : a.handoff_mode === 'temperatura'
      ? { mode: 'temperatura', min_temperature: a.min_temperature }
      : { mode: a.handoff_mode };
  if (!iguais(transfer, transferAtual)) p.transfer_config = transfer;

  if (a.followup_enabled !== (agent.followup_enabled === true)) p.followup_enabled = a.followup_enabled;
  if (a.followup_min_days !== agent.followup_min_days) p.followup_min_days = a.followup_min_days;
  if (a.followup_max_days !== agent.followup_max_days) p.followup_max_days = a.followup_max_days;
  if (a.followup_max_attempts !== agent.followup_max_attempts) p.followup_max_attempts = a.followup_max_attempts;
  if (a.followup_action !== (agent.followup_action ?? 'ai')) p.followup_action = a.followup_action;

  // As três escolhas de destino são limpáveis: vazio viaja como `null`, que é o
  // que o servidor entende por "não escolhi coluna/funil nenhum".
  const stage = a.followup_stage_id || null;
  if (stage !== (agent.followup_stage_id ?? null)) p.followup_stage_id = stage;
  const retorno = a.followup_return_stage_id || null;
  if (retorno !== (agent.followup_return_stage_id ?? null)) p.followup_return_stage_id = retorno;
  const funil = a.followup_sequence_slug || null;
  if (funil !== (agent.followup_sequence_slug ?? null)) p.followup_sequence_slug = funil;

  if (!iguais(a.followup_janelas, janelaDoFollowup(agent))) {
    p.followup_hours = { mode: 'custom', tz: FUSO, windows: a.followup_janelas };
  }

  if (a.pipeline_move_enabled !== (agent.pipeline_move_enabled === true)) p.pipeline_move_enabled = a.pipeline_move_enabled;
  const pipeline = a.pipeline_id || null;
  if (pipeline !== (agent.pipeline_id ?? null)) p.pipeline_id = pipeline;
  const mapa: Record<string, string> = {};
  Object.entries(a.pipeline_stage_map ?? {}).forEach(([k, v]) => { if (v) mapa[k] = v; });
  if (!iguais(mapa, agent.pipeline_stage_map ?? {})) p.pipeline_stage_map = mapa;

  // 2 + 3. O roteiro (modo da pergunta, termo e pontos-chave), inteiro.
  const playbook = playbookDasRespostas(a, agent.playbook);
  if (!iguais(playbook, agent.playbook ?? {})) p.playbook = playbook;

  return p;
}
