/**
 * As PÁGINAS do Configurar da IA (onda 3, 06/10/2026): 5 grupos na ordem da
 * conversa, cada um com 1 a 5 páginas curtas (decisão 1 do Tony, opção A). Fonte
 * única de: rótulo e frase (decisão 2: termo do ramo + uma linha), campos que a
 * página pode gravar, endereço (`?pagina=`, e o `?passo=` antigo traduzido) e a
 * trava do Agendamento. Spec: LM FLOW/specs/2026-10-06-ia-configurar-reestruturacao-design.md §3.
 *
 * ⚠️ Campo novo numa página entra no `campos` DELA (por subchave, se for jsonb
 * dividido): o `ConfigurarPaginas` recusa gravar campo de fora (erro de
 * programação), e o paginas.spec confere que nada saiu sem querer.
 */
import type { HealthReport, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { pendenciasDasPaginas } from '@/features/salesAgents/pendencias';
import type { InboxOption } from '../configuracao/comum';
import type { Gravar } from './useGravarNaHora';

export type GrupoDePaginas = 'atendimento' | 'introducao' | 'conversa' | 'repasse' | 'followup';
export type PaginaId =
  | 'canal' | 'horario' | 'identidade' | 'abertura' | 'intencao' | 'personalidade' | 'qualificacao' | 'catalogo'
  | 'restricoes' | 'objetivo' | 'criterio' | 'destino' | 'funil' | 'agendamento' | 'followup';

export interface PaginaInfo {
  id: PaginaId;
  grupo: GrupoDePaginas;
  titulo: string;
  frase: string;
  campos: readonly string[];
}

export const GRUPOS_DE_PAGINAS: { id: GrupoDePaginas; rotulo: string; paginas: PaginaId[] }[] = [
  { id: 'atendimento', rotulo: 'Atendimento', paginas: ['canal', 'horario'] },
  { id: 'introducao', rotulo: 'Introdução', paginas: ['identidade', 'abertura', 'intencao'] },
  { id: 'conversa', rotulo: 'Conversa', paginas: ['personalidade', 'qualificacao', 'catalogo', 'restricoes'] },
  { id: 'repasse', rotulo: 'Repasse', paginas: ['objetivo', 'criterio', 'destino', 'funil', 'agendamento'] },
  { id: 'followup', rotulo: 'Follow-up', paginas: ['followup'] },
];

export const PAGINAS: Record<PaginaId, PaginaInfo> = {
  canal: { id: 'canal', grupo: 'atendimento', titulo: 'Canal', frase: 'Em qual número ela atende, de que jeito e quais leads.',
    campos: ['inbox_id', 'followup_only', 'triggers', 'trigger_match_mode', 'trigger_keyword'] },
  horario: { id: 'horario', grupo: 'atendimento', titulo: 'Horário', frase: 'Quando ela responde e o que diz fora do horário.',
    campos: ['active_hours', 'out_of_hours_reply', 'out_of_hours_message'] },
  identidade: { id: 'identidade', grupo: 'introducao', titulo: 'Identidade', frase: 'Em nome de quem ela fala e como se apresenta.',
    campos: ['name', 'lead_facing_name', 'persona_kind', 'transfer_config.voice', 'handoff_target', 'handoff_roleta_config_id', 'handoff_user_id'] },
  abertura: { id: 'abertura', grupo: 'introducao', titulo: 'Abertura', frase: 'A primeira mensagem e as variações por campanha.',
    campos: ['greeting', 'default_origin', 'opening_image_url', 'opening_audio_url', 'openings'] },
  intencao: { id: 'intencao', grupo: 'introducao', titulo: 'Intenção', frase: 'A pergunta que separa os leads e o caminho de cada resposta.',
    campos: ['intent_question', 'playbook.intent_question_mode', 'playbook.vars.caminhos_intencao'] },
  personalidade: { id: 'personalidade', grupo: 'conversa', titulo: 'Personalidade', frase: 'O formato das respostas: mensagens, áudio e curtidas.',
    campos: ['message_split_enabled', 'audio_enabled', 'audio_mode', 'audio_voice_id', 'reaction_enabled', 'reaction_emojis', 'reaction_max_per_conversation'] },
  qualificacao: { id: 'qualificacao', grupo: 'conversa', titulo: 'Qualificação', frase: 'As perguntas que ela faz pra entender o lead.',
    campos: ['qualification_questions', 'transfer_config.required_questions'] },
  catalogo: { id: 'catalogo', grupo: 'conversa', titulo: 'Catálogo', frase: 'O que ela vende e o que pode mandar dos imóveis.',
    campos: ['playbook.vars.tipo_venda', 'locacao_enabled', 'default_property_code', 'catalog_search_enabled', 'cross_sell_enabled',
      'rich_media_enabled', 'send_property_book_enabled', 'book_send_rule'] },
  restricoes: { id: 'restricoes', grupo: 'conversa', titulo: 'Restrições', frase: 'O que ela nunca informa sozinha.',
    campos: ['ai_limits.address', 'ai_limits.discount', 'ai_limits.price', 'ai_limits.iptu', 'ai_limits.custom'] },
  objetivo: { id: 'objetivo', grupo: 'repasse', titulo: 'Objetivo', frase: 'Até onde ela leva a conversa.',
    campos: ['reach', 'booking_enabled', 'transfer_config.mode'] },
  criterio: { id: 'criterio', grupo: 'repasse', titulo: 'Critério', frase: 'Quando o lead está pronto pra ir pra uma pessoa.',
    campos: ['transfer_config.mode', 'transfer_config.min_temperature', 'crm_policy.cold',
      'escalate_on_frustration', 'escalate_on_human_request', 'escalate_on_ai_detected'] },
  destino: { id: 'destino', grupo: 'repasse', titulo: 'Destino', frase: 'Pra quem o lead vai e o que vai junto.',
    // `persona_kind`: o "Passar a entregar pro dono do número" da IA antiga (persona só DERIVADA da voz) grava a persona junto.
    campos: ['handoff_target', 'handoff_roleta_config_id', 'handoff_user_id', 'handoff_webhook_url', 'transfer_config.briefing_enabled', 'persona_kind'] },
  funil: { id: 'funil', grupo: 'repasse', titulo: 'Funil', frase: 'Onde o card fica em cada momento da conversa.',
    campos: ['pipeline_move_enabled', 'pipeline_id', 'pipeline_stage_map'] },
  agendamento: { id: 'agendamento', grupo: 'repasse', titulo: 'Agendamento', frase: 'Como ela marca a visita.',
    campos: ['visit_duration_minutes', 'visit_config.days', 'visit_config.start', 'visit_config.end', 'visit_config.min_advance_hours',
      'visit_config.max_advance_days', 'visit_config.same_day_requires_human', 'visit_config.avoid_double_booking',
      'ask_google_review', 'google_review_link', 'playbook.vars.lead_pronto'] },
  followup: { id: 'followup', grupo: 'followup', titulo: 'Follow-up', frase: 'O que ela faz quando o lead para de responder.',
    campos: ['followup_enabled', 'followup_min_days', 'followup_max_days', 'followup_action', 'followup_stage_id',
      'followup_return_stage_id', 'followup_flow_id', 'followup_pipeline_ids', 'followup_hours', 'reengagement_enabled',
      'reengagement_first_hours', 'reengagement_second_hours'] },
};

export const ORDEM_DAS_PAGINAS: PaginaId[] = GRUPOS_DE_PAGINAS.flatMap((g) => g.paginas);

export const rotuloDoGrupo = (p: PaginaId) => GRUPOS_DE_PAGINAS.find((g) => g.id === PAGINAS[p].grupo)!.rotulo;

/** O `?passo=N` do passo a passo (05/10) → a página que tem o começo daquele passo. */
export const PASSO_PARA_PAGINA: Record<string, PaginaId> = {
  1: 'identidade', 2: 'objetivo', 3: 'abertura', 4: 'agendamento', 5: 'catalogo', 6: 'canal', 7: 'followup', 8: 'canal',
};

export function paginaDaUrl(params: URLSearchParams): PaginaId | null {
  const pedida = params.get('pagina');
  if (pedida && Object.prototype.hasOwnProperty.call(PAGINAS, pedida)) return pedida as PaginaId;
  const passo = params.get('passo');
  // ⚠️ hasOwnProperty: `?passo=constructor` não pode achar nada na cadeia do protótipo.
  return passo && Object.prototype.hasOwnProperty.call(PASSO_PARA_PAGINA, passo) ? PASSO_PARA_PAGINA[passo] : null;
}

type Lido = Parameters<typeof pendenciasDasPaginas>[0];

export function agendamentoTravado(agent: Parameters<typeof lerEscolhas>[0]): boolean {
  return lerEscolhas(agent).alcance !== 'visit';
}

/** Sem `?pagina=`: a primeira com pendência na ordem do trilho, senão Canal. */
export function paginaInicial(agent: Lido): PaginaId {
  return pendenciasDasPaginas(agent)[0]?.pagina ?? 'canal';
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
