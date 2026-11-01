/**
 * As PÁGINAS do Configurar da IA: 8 páginas (Tarefa 70, 01/11/2026; eram 15 em 5
 * grupos desde 06/10/2026). Fonte única de: rótulo e frase (tela 3 do protótipo
 * aprovado), campos que a página pode gravar, endereço (`?pagina=`, com os 15 ids
 * antigos e o `?passo=` traduzidos) e a vizinhança do "← Anterior · Próxima →".
 * Spec: LM FLOW/docs/superpowers/ia-reestruturacao/specs/2026-10-31-fase-6-tela-design.md §3.
 *
 * ⚠️ Campo novo numa página entra no `campos` DELA (por subchave, se for jsonb
 * dividido): o `ConfigurarPaginas` recusa gravar campo de fora (erro de
 * programação), e o paginas.spec confere que nada saiu sem querer.
 */
import { Compass, Filter, Megaphone, Paperclip, Send, Target, UserRound, Users, type LucideIcon } from 'lucide-react';
import type { HealthReport, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { pendenciasDasPaginas } from '@/features/salesAgents/pendencias';
import type { InboxOption } from '../configuracao/comum';
import type { Gravar } from './useGravarNaHora';

export type PaginaId = 'modo' | 'numeros' | 'publico' | 'campanhas' | 'conducao' | 'materiais' | 'destino' | 'funil';

/** O rótulo único do índice (as 8 páginas moram num grupo só). */
export const ROTULO_DO_CONFIGURAR = 'Configurar';

export interface PaginaInfo {
  id: PaginaId;
  titulo: string;
  frase: string;
  icone: LucideIcon;
  campos: readonly string[];
}

export const PAGINAS: Record<PaginaId, PaginaInfo> = {
  modo: { id: 'modo', titulo: 'Modo operante', frase: 'O que ela faz, o que oferece no fim e quando passa o lead antes da hora.', icone: Target,
    // Agendamento de hoje (agenda da visita, avaliação no Google, quando propor) mora aqui, só no Leva até a visita.
    campos: ['job', 'next_steps', 'handoff_exceptions', 'house_voice.office_address',
      'visit_duration_minutes', 'visit_config.days', 'visit_config.start', 'visit_config.end', 'visit_config.min_advance_hours',
      'visit_config.max_advance_days', 'visit_config.same_day_requires_human',
      'ask_google_review', 'google_review_link', 'playbook.vars.lead_pronto'] },
  numeros: { id: 'numeros', titulo: 'Números e usuários', frase: 'Onde ela atende, quem fala em cada número e quando ela responde. Usuária nova = número novo aqui, não uma IA nova.', icone: UserRound,
    campos: ['house_voice.kind', 'house_voice.name', 'house_voice.gender', 'house_voice.intro',
      'active_hours', 'out_of_hours_reply', 'out_of_hours_message'] },
  publico: { id: 'publico', titulo: 'Público-alvo e produto', frase: 'O que ela vende e pra quem. O detalhe de cada empreendimento (condição, pra quem serve, objeções) mora no cadastro dele.', icone: Users,
    campos: ['serves', 'default_property_code', 'catalog_search_enabled', 'cross_sell_enabled',
      'playbook.vars.caminhos_intencao', 'playbook.vars.fora_dos_caminhos', 'intent_question', 'playbook.intent_question_mode'] },
  campanhas: { id: 'campanhas', titulo: 'Campanhas e gatilhos', frase: 'Quais leads ela pega e como começa com cada campanha.', icone: Megaphone,
    campos: ['triggers', 'trigger_match_mode', 'trigger_keyword', 'openings'] },
  conducao: { id: 'conducao', titulo: 'Condução', frase: 'Como ela conduz a conversa: como abre, o que descobre, como escreve e o que nunca fala.', icone: Compass,
    campos: ['greeting', 'default_origin', 'opening_image_url', 'opening_audio_url',
      'qualification_questions', 'transfer_config.required_questions',
      'message_split_enabled', 'audio_enabled', 'audio_mode', 'audio_voice_id', 'reaction_enabled', 'reaction_emojis', 'reaction_max_per_conversation',
      'ai_limits.address', 'ai_limits.discount', 'ai_limits.price', 'ai_limits.iptu', 'ai_limits.custom'] },
  materiais: { id: 'materiais', titulo: 'Materiais', frase: 'O que ela pode mandar, da casa e de cada imóvel, com o momento certo de mandar. Ela escolhe pela conversa.', icone: Paperclip,
    campos: ['rich_media_enabled', 'send_property_book_enabled', 'book_send_rule', 'location_pin_enabled'] },
  destino: { id: 'destino', titulo: 'Destino', frase: 'Pra quem o lead vai, onde o atendimento continua e o que acontece depois.', icone: Send,
    campos: ['handoff_target', 'handoff_roleta_config_id', 'handoff_user_id', 'handoff_webhook_url', 'handoff_webhook_system', 'handoff_cvcrm',
      'transfer_config.briefing_enabled', 'handoff_continue_at', 'handoff_service_inbox_id', 'handoff_arrival_message'] },
  funil: { id: 'funil', titulo: 'Funil e follow-up', frase: 'Onde o card fica em cada momento e o que ela faz quando o lead some.', icone: Filter,
    campos: ['pipeline_move_enabled', 'pipeline_id', 'pipeline_stage_map', 'followup_only',
      'followup_enabled', 'followup_min_days', 'followup_max_days', 'followup_action', 'followup_stage_id',
      'followup_return_stage_id', 'followup_flow_id', 'followup_pipeline_ids', 'followup_hours', 'reengagement_enabled',
      'reengagement_first_hours', 'reengagement_second_hours'] },
};

export const ORDEM_DAS_PAGINAS: PaginaId[] = ['modo', 'numeros', 'publico', 'campanhas', 'conducao', 'materiais', 'destino', 'funil'];

/** A página anterior e a próxima, pro pé. Nulo nas pontas. */
export function vizinhas(p: PaginaId): { anterior: PaginaId | null; proxima: PaginaId | null } {
  const i = ORDEM_DAS_PAGINAS.indexOf(p);
  return { anterior: ORDEM_DAS_PAGINAS[i - 1] ?? null, proxima: ORDEM_DAS_PAGINAS[i + 1] ?? null };
}

/**
 * Os `?pagina=` das 15 páginas antigas (e das 8 novas) → a página nova (spec §3).
 * ⚠️ Intenção, Objetivo, Critério e Identidade saíram como página; os endereços
 * velhos (favoritos, links do Painel, avisos) caem onde o assunto foi parar.
 */
export const PAGINA_ANTIGA: Record<string, PaginaId> = {
  canal: 'numeros', horario: 'numeros', identidade: 'numeros',
  abertura: 'conducao', personalidade: 'conducao', qualificacao: 'conducao', restricoes: 'conducao',
  intencao: 'publico', catalogo: 'publico',
  objetivo: 'modo', criterio: 'modo', agendamento: 'modo',
  followup: 'funil',
  modo: 'modo', numeros: 'numeros', publico: 'publico', campanhas: 'campanhas', conducao: 'conducao', materiais: 'materiais',
  destino: 'destino', funil: 'funil',
};

/** O `?passo=N` do passo a passo (05/10) → a página que tem o assunto daquele passo. */
export const PASSO_PARA_PAGINA: Record<string, PaginaId> = {
  1: 'numeros', 2: 'modo', 3: 'conducao', 4: 'modo', 5: 'publico', 6: 'numeros', 7: 'funil', 8: 'numeros',
};

const tem = (tabela: object, chave: string) => Object.prototype.hasOwnProperty.call(tabela, chave);

export function paginaDaUrl(params: URLSearchParams): PaginaId | null {
  const pedida = params.get('pagina');
  // ⚠️ hasOwnProperty: `?pagina=constructor` não pode achar nada na cadeia do protótipo.
  if (pedida && tem(PAGINA_ANTIGA, pedida)) return PAGINA_ANTIGA[pedida];
  const passo = params.get('passo');
  return passo && tem(PASSO_PARA_PAGINA, passo) ? PASSO_PARA_PAGINA[passo] : null;
}

type Lido = Parameters<typeof pendenciasDasPaginas>[0];

/**
 * A agenda da visita só vale no Leva até a visita. O trabalho gravado manda; agente
 * ainda sem `job` (não migrado) segue o alcance lido das colunas antigas.
 */
export function agendamentoTravado(agent: Lido & Partial<Pick<SalesAgent, 'job'>>): boolean {
  if (agent.job) return agent.job !== 'leva_visita';
  return lerEscolhas(agent).alcance !== 'visit';
}

/** Sem `?pagina=`: a primeira com pendência na ordem do índice, senão Modo operante. */
export function paginaInicial(agent: Lido): PaginaId {
  return pendenciasDasPaginas(agent)[0]?.pagina ?? 'modo';
}

/** ⚠️ Erro de programação: página gravando campo que não é dela. */
export function conferirCamposDaPagina(pagina: PaginaId, campos: string[]): void {
  const fora = campos.find((c) => !PAGINAS[pagina].campos.includes(c));
  if (fora) throw new Error(`A página ${pagina} não grava ${fora}. Ponha o campo em paginas.ts.`);
}

export interface PropsDaPagina {
  agent: SalesAgent;
  inboxes: InboxOption[];
  /** Grava na hora (só os campos desta página). */
  gravar: Gravar;
  irPara: (pagina: PaginaId) => void;
  /** O Diagnóstico da IA aberta (a casca lê). Null enquanto carrega ou se falhou. */
  diagnostico: HealthReport | null;
  /**
   * A chave do Sistema do cliente foi gerada (ação própria, nunca pelo salvar da IA):
   * a casca marca "pronta" na IA aberta. Só o Destino usa.
   */
  aoChaveGerada?: () => void;
}
