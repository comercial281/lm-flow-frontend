import api from '@/services/core/api';
import { isForbiddenError } from '@/services/core/forbidden';

// Um número de WhatsApp dentro da roleta.
//
// A roleta deixou de ser presa a um número: ela tem N instâncias, cada uma com
// peso próprio, e o sorteio acontece em dois níveis — primeiro a instância,
// depois o corretor DAQUELA instância. A roleta de número compartilhado é o caso
// particular de UMA instância, e é o que todo cliente existente tem.
//
// `inbox_id` é a chave natural (é único no backend), e é por ele que o membro
// diz em qual número atende.
export interface RoletaInstance {
  id?: string;
  inbox_id: string;
  inbox_name?: string | null;
  // Apelido do gestor ("WhatsApp do João"). Cai no nome da instância quando vazio.
  label?: string | null;
  display_name?: string;
  weight: number;
  is_active: boolean;
  position: number;
  /**
   * Esta roleta atende quem escreve DIRETO para este número?
   *
   * O mesmo WhatsApp pode estar em várias roletas (campanhas diferentes, cada
   * uma alimentada por sua fonte). Nas fontes não há ambiguidade: o formulário
   * ou portal já aponta a roleta. Ela só existe quando alguém escreve direto
   * para o número — e é isto que decide quem responde nesse caso.
   *
   * Com o número numa roleta só, ela responde de qualquer jeito. Sem ninguém
   * marcado num número compartilhado, quem escreve direto não entra em roleta.
   */
  answers_direct_inbound?: boolean;
  /**
   * Este número é COMPARTILHADO (vários corretores; quem escreve nele entra na
   * oferta) ou EXCLUSIVO (um corretor; quem escreve nele vai direto a ele)?
   * Gravado, não adivinhado contando corretores. Ausente = exclusivo.
   */
  shared?: boolean;
  /** Nome das OUTRAS roletas que atendem por este mesmo número (só leitura). */
  shared_with?: string[];
  /**
   * Fase 2b.1: o DONO do número (efetivo), quando a regra do dono vale neste
   * cliente; `null` = da imobiliária. Ausente = servidor antigo.
   */
  owner?: { id: string; name: string } | null;
}

export interface RoletaMember {
  id?: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  weight: number;
  is_active: boolean;
  position: number;
  // O número desta roleta é a EXCEÇÃO ("me avise em outro número neste caso").
  // Vazio = usa o do cadastro da pessoa, em Equipe.
  personal_whatsapp_number: string;
  // O que está no cadastro dele — a tela mostra como sugestão no campo vazio.
  whatsapp_from_profile?: string | null;
  // O que o servidor vai usar de verdade, já com DDI. Nulo = ninguém será avisado.
  whatsapp_effective?: string | null;
  // Por que não há número utilizável: 'sem_numero' ou 'numero_da_conta'.
  whatsapp_reason?: string | null;
  // Por qual número ESTE corretor atende. O backend devolve os dois; no envio
  // só `inbox_id` importa (é o que ele usa para amarrar a instância).
  roleta_instance_id?: string | null;
  inbox_id?: string | null;
  // Roleta nova (chave `roleta_nova`, PR do servidor B2): o nome de quem está
  // na fila e a situação do número DELE (a roleta não tem número próprio).
  // Ausentes no servidor antigo.
  name?: string | null;
  phone_display?: string | null;
  phone_status?: RoletaPhoneStatus | null;
}

/** Situação do número próprio do corretor na fila: conectado, caído ou sem número. */
export type RoletaPhoneStatus = 'connected' | 'disconnected' | 'none';

/**
 * Os PADRÕES DA CASA — respondidos uma vez, herdados por toda roleta NOVA.
 *
 * ⚠️ Herdar é SEMEAR: o valor vira dado da roleta no momento em que ela nasce.
 * Roleta que já existe não muda nada, nem hoje nem quando o padrão for editado.
 * Foi decisão do dono do produto, e é o que garante que as imobiliárias que já
 * rodam não sentem nada.
 */
export interface RoletaDefaults {
  gestor_whatsapp_number?: string | null;
  gestor_group_jid?: string | null;
  gestor_group_instance?: string | null;
  notification_inbox_id?: string | null;
  timeout_minutes?: number | null;
  business_hours_config?: RoletaBusinessHours | null;
  msg_corretor_template?: string | null;
  msg_gestor_template?: string | null;
  msg_grupo_template?: string | null;
  msg_grupo_repasse_template?: string | null;
  msg_corretor_enabled?: boolean;
  msg_gestor_enabled?: boolean;
  msg_grupo_enabled?: boolean;
  msg_grupo_repasse_enabled?: boolean;
}

// Modo de distribuição. A RoletaConfig é a FONTE ÚNICA: modo + quem + prazo + gestor.
// Os nomes aqui são os mesmos que aparecem na tela, de propósito.
export type DistributionMode = 'rodizio' | 'leilao' | 'manual' | 'disponibilidade' | 'fila';

/**
 * Horário de funcionamento da roleta.
 *
 * ⚠️ O campo `business_hours_config` existe no banco desde que a tabela nasceu,
 * era aceito pela API e devolvido no JSON — e NÃO FAZIA NADA: nenhum motor lia a
 * coluna, e esta tela nunca enviou o campo (ele nem estava no Payload). Quem
 * configurasse horário por fora achava que tinha configurado.
 *
 * Mesmo formato do `active_hours` da IA Vendedora, mais os dois campos do
 * plantão. `always` (ou vazio) = 24h, que é o valor de toda roleta existente.
 */
export type RoletaHoursMode = 'always' | 'custom';

export interface RoletaHoursWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  /** 0=domingo … 6=sábado. Ausente ou vazio = todos os dias. */
  days?: number[];
}

export interface RoletaBusinessHours {
  mode?: RoletaHoursMode;
  tz?: string;
  windows?: RoletaHoursWindow[];
  /**
   * O número de PLANTÃO: quem atende o lead que chega com a roleta fechada.
   * Qualquer inbox da conta — não precisa ser um dos números da roleta.
   * Nulo/ausente = ninguém atende, o lead fica sem dono no funil.
   */
  after_hours_inbox_id?: string | null;
  /** Quando o horário reabre, o lead parado no plantão volta pro sorteio sozinho. */
  auto_distribute_on_open?: boolean;
}

export interface RoletaConfig {
  id: string;
  // `name` é o que o gestor digitou e pode ser nulo; `display_name` é o que a
  // tela mostra, já caindo no nome da instância quando ninguém batizou. Os dois
  // vêm juntos de propósito: o formulário precisa do campo VAZIO para o
  // placeholder aparecer, a listagem precisa do resolvido.
  name?: string | null;
  display_name?: string | null;
  inbox_id: string;
  inbox_name?: string | null;
  is_active: boolean;
  distribution_mode: DistributionMode;
  timeout_minutes: number;
  gestor_whatsapp_number: string;
  gestor_group_jid: string | null;
  gestor_group_instance: string | null;
  msg_corretor_template: string | null;
  msg_gestor_template: string | null;
  msg_grupo_template: string | null;
  // Texto do prazo estourado. Separado do de cima porque nenhum serve para as
  // duas situações — o de lead novo mentia no repasse.
  msg_grupo_repasse_template: string | null;
  // Liga/desliga de cada aviso. Texto em branco = usa o padrão; isto aqui é o
  // "não envia". Opcional porque config antiga pode responder sem os campos —
  // ausente vale como LIGADO.
  msg_corretor_enabled?: boolean;
  msg_gestor_enabled?: boolean;
  msg_grupo_enabled?: boolean;
  msg_grupo_repasse_enabled?: boolean;
  notification_inbox_id: string | null;
  // A instância do servidor Evolution COMPARTILHADO que envia os avisos, quando
  // a Leal Mídia escolheu uma que não é canal deste cliente (2026-09-16).
  // Preenchida, vence o canal acima. Nula em toda roleta que não a escolheu.
  notification_instance_name?: string | null;
  business_hours_config: RoletaBusinessHours;
  instances?: RoletaInstance[];
  // A FLAG do cliente: pode adicionar um segundo número? Liberada por cliente
  // pela Leal Mídia (nasce desligada).
  multi_instance_enabled?: boolean;
  // O estado REAL, derivado do dado: já tem mais de um número ativo? Os dois são
  // necessários — um decide se aparece o botão de adicionar, o outro decide se
  // aparecem os pesos por instância.
  multi_instancia?: boolean;
  // Fase 2b.1: a regra do dono do número vale neste cliente? Com ela, a tela
  // não pergunta Exclusivo/Compartilhado (o servidor nem lê a marca).
  number_owner_rule?: boolean;
  members: RoletaMember[];
  created_at: string;
  updated_at: string;
  // ── Roleta nova (chave `roleta_nova`, servidor B2). Ausentes no servidor antigo.
  /** As origens já em frase curta pro cartão da lista ("Formulário "ZONA SUL""). */
  origins_summary?: string[];
  /** Ofertas esperando o aceite agora. */
  pending_count?: number;
  /** Leads que passaram por todos e ninguém aceitou, nos últimos 7 dias. */
  exhausted_count_7d?: number;
  /** Fora do horário, manda uma mensagem pro lead enquanto ele espera. */
  after_hours_message_enabled?: boolean;
  after_hours_message?: string | null;
  /** Número que manda a mensagem de fora do horário. */
  after_hours_inbox_id?: string | null;
}

export interface RoletaConfigPayload {
  // Vazio = sem apelido; a roleta volta a se chamar pelo nome da instância.
  name?: string | null;
  inbox_id: string;
  is_active: boolean;
  distribution_mode: DistributionMode;
  timeout_minutes: number;
  gestor_whatsapp_number: string;
  gestor_group_jid?: string | null;
  gestor_group_instance?: string | null;
  msg_corretor_template?: string | null;
  msg_gestor_template?: string | null;
  msg_grupo_template?: string | null;
  msg_grupo_repasse_template?: string | null;
  msg_corretor_enabled?: boolean;
  msg_gestor_enabled?: boolean;
  msg_grupo_enabled?: boolean;
  msg_grupo_repasse_enabled?: boolean;
  notification_inbox_id?: string | null;
  // Só a Leal Mídia manda esta chave (o servidor recusa outro cargo gravando
  // um nome). Ausente = não mexe no que está gravado; `null` = volta ao canal.
  notification_instance_name?: string | null;
  // ⚠️ Faltava aqui, e era por isso que o horário nunca chegava ao backend: a
  // tela recebia o campo no GET e o descartava no save. Opcional porque roleta
  // sem horário (24h) não manda nada — que é o estado de todas elas hoje.
  business_hours_config?: RoletaBusinessHours;
  // Roleta nova (servidor B2): a mensagem pro lead que chega fora do horário.
  after_hours_message_enabled?: boolean;
  after_hours_message?: string | null;
  after_hours_inbox_id?: string | null;
  // Sincronizadas DENTRO de create/update, não numa rota própria: o RBAC deriva
  // a permissão pelo nome da action, então uma action nova exigiria uma
  // permissão que nenhum cargo tem e a tela tomaria 403 sem pista nenhuma.
  //
  // Lista vazia = "não mexe nas instâncias". O backend nunca deixa a roleta sem
  // nenhuma, porque sem instância o sorteio morre calado.
  instances?: Omit<RoletaInstance, 'id' | 'inbox_name' | 'display_name' | 'shared_with'>[];
  // `personal_whatsapp_number` vai como `null` quando o campo está vazio: é
  // assim que o servidor entende "usa o do cadastro da pessoa". Os campos
  // derivados (`whatsapp_from_profile`, `whatsapp_effective`, `whatsapp_reason`)
  // são só de LEITURA — o servidor os calcula, a tela não os manda de volta.
  members: (Omit<RoletaMember,
    'id' | 'user_name' | 'user_avatar' | 'roleta_instance_id'
    | 'personal_whatsapp_number' | 'whatsapp_from_profile' | 'whatsapp_effective' | 'whatsapp_reason'
    | 'name' | 'phone_display' | 'phone_status'
  > & { personal_whatsapp_number: string | null })[];
}

export interface BrokerAssignment {
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  assigned_user: { id: string; name: string | null };
  status: 'pending' | 'accepted' | 'passed' | 'expired' | 'cancelled';
  assigned_at: string;
  accepted_at: string | null;
  passed_at: string | null;
  timeout_minutes: number;
  round: number;
}

// Uma tentativa de distribuição, com o veredito em português. Alimenta o painel
// "Por que este lead não entrou na roleta?" — que existe porque cada portão do
// caminho formulário → roleta falhava calado num log do servidor.
// Espelha RoletaEvent::OUTCOMES no backend. Estava desatualizado: faltavam seis
// vereditos que o backend já gravava, e um deles chegando aqui caía no `default`
// da tela como se fosse desconhecido.
export type RoletaOutcome =
  | 'sem_config'
  | 'config_sem_roleta'
  | 'roleta_inexistente'
  | 'roleta_inativa'
  | 'modo_manual'
  // Chegou com a roleta fechada: ninguém foi sorteado e quem atende é o número
  // de plantão. E o par dele, quando o horário reabre e o lead entra no sorteio.
  | 'fora_do_horario'
  | 'distribuido_na_abertura'
  | 'sem_membros'
  | 'sem_acesso_ao_inbox'
  | 'roleta_esgotada'
  | 'dono_gravado'
  // Não houve sorteio porque não havia o que sortear: a pessoa escreveu direto
  // para um número atendido por um corretor só, e já escolheu o corretor.
  | 'atendimento_direto'
  | 'corretor_sem_whatsapp'
  | 'oferta_cancelada'
  // O mesmo lead chegou de novo (portal reenviou, ou veio por dois caminhos)
  // enquanto a oferta anterior ainda esperava resposta: não houve sorteio novo
  // nem aviso repetido, a oferta em aberto continua valendo.
  | 'oferta_ja_pendente'
  // Lead que já tem corretor não volta para o sorteio: continua com quem já
  // cuidava dele.
  | 'lead_ja_tem_dono'
  // O lead TEM dono; o que falhou foi abrir o atendimento no número sorteado.
  | 'canal_nao_aberto'
  | 'instancia_divergente'
  // A gestão trocou o responsável na mão e o atendimento foi levado para o
  // número do novo corretor — as próximas mensagens saem por ele.
  | 'instancia_movida'
  | 'dono_falhou'
  | 'erro';

export interface RoletaDiagnostic {
  id: string;
  created_at: string;
  outcome: RoletaOutcome;
  ok: boolean;
  explicacao: string;
  // De QUAL roleta é esta linha. Com uma roleta por cliente a pergunta não
  // existia; com várias, "o lead não entrou" sem dizer onde não é diagnóstico.
  roleta: string | null;
  formulario: string | null;
  lead: string | null;
  contact_id: string | null;
  corretor: string | null;
  // Dono do contato AGORA — diferencia "ficou órfão" de "ficou órfão e alguém
  // já resolveu na mão".
  dono_atual: string | null;
  // Só vem pro super-admin: a exceção crua que o rescue mudo escondia.
  erro_tecnico?: string | null;
}

// A FILA da roleta, vista por quem gerencia: as ofertas em aberto AGORA, de todo
// mundo. Não confundir com a fila pessoal (brokerAssignmentsService.listMine),
// que é sempre a de quem pergunta — inclusive para admin.
export interface RoletaQueueItem {
  id: string;
  // De qual roleta é a oferta. Servidor antigo não manda: aí a tela cai no
  // nome do número (`instancia`), que pode repetir entre roletas.
  roleta_config_id?: string | null;
  lead: string;
  lead_telefone: string | null;
  contact_id: string;
  conversation_id: string | null;
  conversation_display_id: number | null;
  corretor: { id: string; nome: string | null };
  instancia: string | null;
  modo: DistributionMode | null;
  atribuido_em: string;
  // Zero = roleta sem prazo de aceite; aí `minutos_restantes` vem nulo e
  // `estourou` é sempre falso.
  prazo_minutos: number;
  minutos_restantes: number | null;
  sem_prazo?: boolean;
  // Prazo vencido mas o status ainda é `pending`: o repasse só acontece quando o
  // CheckTimeoutJob roda. É essa janela que o gestor precisa enxergar.
  estourou: boolean;
  rodada: number;
  // Quem já deixou passar antes, na ordem: ["Ana (recusou)", "Bruno (prazo estourou)"].
  ja_passaram: string[];
}

export interface RoletaQueueMember {
  user_id: string;
  nome: string | null;
  peso: number;
  ativo: boolean;
  // Continua na lista da tela mas NUNCA é sorteado (perdeu acesso à instância).
  sem_acesso_a_instancia: boolean;
  // Só no rodízio — nos outros modos quem decide é o leilão/disponibilidade/gestor.
  chance_pct: number | null;
  // Só no modo Fila: é a próxima vez. Servidor antigo não manda.
  proximo?: boolean;
  segurando_agora: number;
  ultimo_lead_em: string | null;
}

export interface RoletaQueueConfig {
  id: string;
  // Como a roleta se chama na tela de configuração. `instancia` é o nome do
  // NÚMERO de entrada — com várias roletas, é ele que fazia a lista virar três
  // blocos parecidos sem dizer qual era qual.
  nome: string | null;
  instancia: string | null;
  modo: DistributionMode;
  ativa: boolean;
  prazo_minutos: number;
  membros: RoletaQueueMember[];
}

export interface RoletaQueue {
  gerado_em: string;
  resumo: { aguardando: number; atrasadas: number; roletas_ativas: number };
  aguardando: RoletaQueueItem[];
  roletas: RoletaQueueConfig[];
}

// Lead que passou por todos os corretores da roleta, ninguém assumiu, e desde
// então ninguém sorteou de novo nem atribuiu na mão.
export interface RoletaExhaustedLead {
  contact_id: string;
  lead: string;
  lead_telefone: string | null;
  roleta_id: string | null;
  roleta: string | null;
  esgotou_em: string;
  /** Quem recebeu o lead no ciclo que esgotou, na ordem. */
  passou_por: string[];
  conversation_id: string | null;
  conversation_display_id: number | null;
  pipeline_item_id: string | null;
  /** Falso quando a roleta está fechada, desativada ou em modo Manual. */
  pode_sortear: boolean;
  bloqueio: string | null;
}

export interface RepairOwnersResult {
  dry_run: boolean;
  total: number;
  corrigidos: number;
  falharam: number;
  leads: {
    contact_id: string;
    lead: string | null;
    corretor: string | null;
    assigned_at: string;
    acao: string;
    motivo?: string | null;
  }[];
}

// Acesso do corretor à INSTÂNCIA do lead dele — as duas pontas na mesma chamada:
// `corretores` é quem precisa ganhar acesso, `revogacoes` é quem carrega vínculo
// automático que já não se justifica (o dono antigo de um lead repassado, que
// aparecia na tela da Instância como atendente do número do colega).
export interface RepairInboxAccessRow {
  user_id: string;
  corretor: string | null;
  instancias: string[];
  total_instancias: number;
  acao: string;
  motivo?: string | null;
}

export interface RepairInboxAccessResult {
  dry_run: boolean;
  total: number;
  liberados: number;
  falharam: number;
  corretores: RepairInboxAccessRow[];
  total_revogar: number;
  revogacoes: RepairInboxAccessRow[];
}

/**
 * O nome da roleta como ela deve aparecer em QUALQUER tela.
 *
 * O gestor batiza a roleta ("Apto Premium"); quando não batiza, ela se chama
 * pelo número de entrada ("apto-premium-bernardo-numero-principal"). Metade das
 * telas resolvia isso na mão e a outra metade mostrava direto o nome do NÚMERO —
 * daí o seletor do card do CRM listar nomes que não batiam com nenhuma roleta da
 * lista de roletas. Uma função só para todas elas contarem a mesma história.
 *
 * Aceita tanto a roleta inteira quanto o resumo que vem no card (só id + nomes).
 */
export function roletaLabel(
  r?: { name?: string | null; display_name?: string | null; inbox_name?: string | null } | null,
): string {
  return r?.display_name?.trim() || r?.name?.trim() || r?.inbox_name?.trim() || 'Roleta';
}

// ── ROLETA NOVA: ORIGENS, HISTÓRICO, PRÓXIMO DA VEZ (chave `roleta_nova`) ────
//
// Contrato do PR do servidor B2 (plano `2026-10-06-roleta-00-indice.md`, seção
// "Nomes compartilhados"). A roleta é disparada por ORIGENS: formulário do Meta
// (exato ou "nome contém"), IA Vendedora, landing, portal e site. A ligação
// origem → roleta é um dado só: esta tela e as telas das origens gravam no
// mesmo lugar.

export type RoletaOriginKind =
  | 'meta_form'
  | 'meta_form_keyword'
  | 'sales_agent'
  | 'landing'
  | 'portal_sale'
  | 'portal_rent'
  | 'site_sale'
  | 'site_rent';

/** Um formulário do Meta que a regra "nome contém" pega hoje. */
export interface RoletaOriginMatch {
  form_id: string;
  form_name: string;
}

/** Uma origem ligada à roleta. Em `meta_form_keyword`, `label` é a palavra. */
export interface RoletaOrigin {
  kind: RoletaOriginKind;
  ref_id: string;
  label: string;
  detail?: string | null;
  matches?: RoletaOriginMatch[];
}

/** Tudo que pode virar origem no cliente, com a roleta que já usa (ou nula). */
export interface RoletaOriginOption {
  kind: RoletaOriginKind;
  ref_id: string;
  label: string;
  detail?: string | null;
  roleta_config_id: string | null;
  roleta_name: string | null;
}

export type NovaOrigem =
  | { kind: Exclude<RoletaOriginKind, 'meta_form_keyword'>; ref_id: string }
  | { kind: 'meta_form_keyword'; keyword: string; meta_page_id?: string };

/** A barreira D9: duas regras "nome contém" pegando o mesmo formulário. */
export interface RoletaOriginConflict {
  form_name: string;
  roleta_name: string;
}

/** Prévia do "nome contém", calculada pelo servidor com a mesma regra do roteador. */
export interface RoletaKeywordPreview {
  matches: RoletaOriginMatch[];
  conflict: RoletaOriginConflict | null;
}

export type RoletaHistoryStatus = 'waiting' | 'accepted' | 'exhausted' | 'not_entered' | 'cancelled';

export interface RoletaHistoryStep {
  at: string;
  label: string;
}

export interface RoletaHistoryItem {
  contact_id: string;
  contact_name: string | null;
  pipeline_item_id: string | null;
  conversation_id: string | null;
  origin_label: string | null;
  status: RoletaHistoryStatus;
  status_label: string | null;
  user_name: string | null;
  at: string;
  steps: RoletaHistoryStep[];
  can_redistribute: boolean;
  /** Só no histórico geral (todas as roletas). */
  roleta_name?: string | null;
}

export interface RoletaHistoryFilters {
  /** Sem roleta = o histórico de todas. */
  roletaId?: string | null;
  filter?: 'all' | 'attention';
  userId?: string | null;
  days?: 7 | 30;
}

/** Quem receberia o próximo lead agora, sem mandar nada a ninguém. */
export interface RoletaNextUp {
  user_id: string | null;
  user_name?: string | null;
  reason?: string | null;
}

// O servidor responde no envelope da casa (`{ success, data }`); o contrato
// descreve o miolo. Aceita os dois, pra tela não quebrar se um lado mudar.
function miolo<T>(res: { data?: unknown }): T {
  const corpo = res?.data as { data?: unknown } | undefined;
  return ((corpo && typeof corpo === 'object' && 'data' in corpo ? corpo.data : corpo) ?? {}) as T;
}

/**
 * O conflito da barreira D9 (422), venha ele solto (`{ error, conflict }`) ou no
 * envelope de erro da casa (`{ error: { message, details: { conflict } } }`).
 */
export function conflitoDaOrigem(erro: unknown): RoletaOriginConflict | null {
  const dados = (erro as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!dados) return null;
  const solto = dados.conflict as RoletaOriginConflict | undefined;
  const err = dados.error as { details?: { conflict?: RoletaOriginConflict } } | undefined;
  const c = solto ?? (typeof err === 'object' ? err?.details?.conflict : undefined);
  return c && c.form_name ? c : null;
}

/** Recusa por cargo (403): a frase da casa, nunca o texto cru do servidor. */
export const MENSAGEM_SEM_PERMISSAO = 'Seu cargo não pode fazer isto. Quem libera é o administrador da conta.';

/**
 * A frase de erro do servidor, em qualquer dos formatos. 403 vira a frase da
 * casa (o corpo do RBAC traz `error` em inglês e `message` em português).
 * Ordem: `message` → `error.message` → `error` em texto (o 422 da chave Ligada
 * vem como `{ error: 'Falta: uma origem' }`).
 */
export function mensagemDoServidor(erro: unknown): string | null {
  if (isForbiddenError(erro)) return MENSAGEM_SEM_PERMISSAO;
  const dados = (erro as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  if (!dados) return null;
  if (typeof dados.message === 'string' && dados.message) return dados.message;
  const err = dados.error as { message?: unknown } | undefined;
  if (err && typeof err === 'object' && typeof err.message === 'string' && err.message) return err.message;
  return typeof dados.error === 'string' && dados.error ? dados.error : null;
}

const BASE = '/roleta_configs';

export const roletaConfigService = {
  async getAll(): Promise<RoletaConfig[]> {
    const res = await api.get(BASE);
    return (res.data as { data: RoletaConfig[] }).data ?? [];
  },

  async getForInbox(inboxId: string): Promise<RoletaConfig | null> {
    try {
      const res = await api.get(`${BASE}/for_inbox/${inboxId}`);
      return (res.data as { data: RoletaConfig }).data;
    } catch {
      return null;
    }
  },

  async create(payload: RoletaConfigPayload): Promise<RoletaConfig> {
    const res = await api.post(BASE, payload);
    return (res.data as { data: RoletaConfig }).data;
  },

  async update(id: string, payload: Partial<RoletaConfigPayload>): Promise<RoletaConfig> {
    const res = await api.patch(`${BASE}/${id}`, payload);
    return (res.data as { data: RoletaConfig }).data;
  },

  async destroy(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  // Atribui um lead manualmente via uma roleta (sorteio ponderado + notifica).
  async assign(
    id: string,
    payload: { contact_id: string; conversation_id?: string; pipeline_item_id?: string },
  ): Promise<BrokerAssignment> {
    const res = await api.post(`${BASE}/${id}/assign`, payload);
    return (res.data as { data: BrokerAssignment }).data;
  },

  // "Por que este lead não entrou na roleta?" — últimas tentativas de
  // distribuição com o veredito de cada portão do caminho.
  async getDiagnostics(opts: { limit?: number; onlyFailures?: boolean } = {}): Promise<RoletaDiagnostic[]> {
    const res = await api.get(`${BASE}/diagnostics`, {
      params: { limit: opts.limit ?? 50, only_failures: opts.onlyFailures ? 'true' : undefined },
    });
    return (res.data as { data: RoletaDiagnostic[] }).data ?? [];
  },

  // Conserta os leads que a roleta sorteou mas ficaram sem responsável no card.
  // dryRun=true (padrão do backend) só lista — e já traz o motivo de cada falha.
  async repairOwners(dryRun: boolean): Promise<RepairOwnersResult> {
    const res = await api.post(`${BASE}/repair_owners`, { dry_run: dryRun });
    return (res.data as { data: RepairOwnersResult }).data;
  },

  // Libera quem precisa e RETIRA o vínculo automático de quem não tem mais lead
  // no número. dryRun=true (padrão do backend) só lista as duas listas.
  async repairInboxAccess(dryRun: boolean): Promise<RepairInboxAccessResult> {
    const res = await api.post(`${BASE}/repair_inbox_access`, { dry_run: dryRun });
    return (res.data as { data: RepairInboxAccessResult }).data;
  },

  // Fila ao vivo (gestão): ofertas em aberto de todos + quem está na roleta.
  // Cargo `roleta_configs.queue` — Gerente e Administrador têm; Corretor não.
  async getQueue(): Promise<RoletaQueue> {
    const res = await api.get(`${BASE}/queue`);
    return (res.data as { data: RoletaQueue }).data;
  },

  // Os padrões da casa: o que toda roleta NOVA já vem preenchida.
  async getDefaults(): Promise<RoletaDefaults> {
    const res = await api.get(`${BASE}/defaults`);
    return (res.data as { data: RoletaDefaults }).data ?? {};
  },

  // ⚠️ Campo em branco APAGA o padrão daquele campo — é a única forma de o
  // gestor desfazer um padrão que não quer mais. Quem não quiser mexer num
  // campo não deve mandá-lo no payload.
  async saveDefaults(payload: RoletaDefaults): Promise<RoletaDefaults> {
    const res = await api.put(`${BASE}/defaults`, payload);
    return (res.data as { data: RoletaDefaults }).data ?? {};
  },

  async getAssignments(status?: string): Promise<BrokerAssignment[]> {
    const params = status ? { status } : {};
    const res = await api.get(`${BASE}/assignments`, { params });
    return (res.data as { data: BrokerAssignment[] }).data ?? [];
  },

  // Leads que esgotaram a roleta e continuam sem responsável.
  async getExhausted(): Promise<RoletaExhaustedLead[]> {
    const res = await api.get(`${BASE}/exhausted`);
    return (res.data as { data: RoletaExhaustedLead[] }).data ?? [];
  },

  // "Sortear de novo": o lead volta para a mesma roleta, do zero. Devolve o nome
  // de quem recebeu a oferta.
  async redistributeExhausted(contactId: string): Promise<{ corretor: string }> {
    const res = await api.post(`${BASE}/exhausted/${contactId}/redistribute`);
    return (res.data as { data: { corretor: string } }).data;
  },

  // Dispara um aviso de TESTE (corretor/gestor/grupo) com dados fictícios,
  // usando os valores atuais do formulário — não precisa salvar antes.
  async testNotification(payload: {
    target: 'corretor' | 'gestor' | 'grupo';
    inbox_id: string;
    notification_inbox_id?: string | null;
    notification_instance_name?: string | null;
    gestor_whatsapp_number?: string | null;
    gestor_group_jid?: string | null;
    gestor_group_instance?: string | null;
    timeout_minutes?: number;
    template?: string | null;
  }): Promise<{ sent_to: string }> {
    const res = await api.post(`${BASE}/test_notification`, payload);
    return (res.data as { data: { sent_to: string } }).data;
  },

  // As instâncias SOLTAS do servidor Evolution compartilhado (as que não são
  // canal de cliente nenhum), para o campo "Número que envia os avisos". Só a
  // Leal Mídia alcança — para o resto o servidor responde 403, e a tela nem
  // pergunta.
  async getCentralInstances(): Promise<CentralInstance[]> {
    return (await this.getCentralInstancesReport()).instances;
  },

  // A lista MAIS o porquê dela estar vazia (`meta.reason`, em português, só
  // preenchido quando não sobrou instância). Sem o motivo, a seção vazia na
  // tela é indistinguível de defeito — foi o que aconteceu na estreia.
  async getCentralInstancesReport(): Promise<CentralInstancesReport> {
    const res = await api.get(`${BASE}/central_instances`);
    const body = res.data as { data?: CentralInstance[]; meta?: { reason?: string | null } };
    return { instances: body.data ?? [], reason: body.meta?.reason ?? null };
  },
  // ── Roleta nova (chave `roleta_nova`) ───────────────────────────────────────

  async get(id: string): Promise<RoletaConfig> {
    const res = await api.get(`${BASE}/${id}`);
    return miolo<RoletaConfig>(res);
  },

  // "Nova roleta": nasce DESLIGADA, só com o nome, no modo Fila (o único da
  // roleta nova). Sem número: a roleta nova não tem número (D6).
  async createDraft(name: string): Promise<RoletaConfig> {
    const res = await api.post(BASE, {
      name,
      is_active: false,
      distribution_mode: 'fila',
      timeout_minutes: 10,
      members: [],
    });
    return miolo<RoletaConfig>(res);
  },

  async getOrigins(id: string): Promise<RoletaOrigin[]> {
    const res = await api.get(`${BASE}/${id}/origins`);
    return miolo<{ origins?: RoletaOrigin[] }>(res).origins ?? [];
  },

  async getOriginOptions(): Promise<RoletaOriginOption[]> {
    const res = await api.get(`${BASE}/origin_options`);
    return miolo<{ options?: RoletaOriginOption[] }>(res).options ?? [];
  },

  // Prévia do "nome contém": quais formulários da página a palavra pega HOJE e
  // se outra regra já pega algum deles (D9). Quem calcula é o servidor, com a
  // regra do roteador (tokens, com acento); a tela não adivinha.
  async getKeywordPreview(keyword: string, metaPageId?: string | null): Promise<RoletaKeywordPreview> {
    const res = await api.get(`${BASE}/keyword_preview`, {
      params: { keyword, meta_page_id: metaPageId || undefined },
    });
    const p = miolo<Partial<RoletaKeywordPreview>>(res);
    return { matches: p.matches ?? [], conflict: p.conflict ?? null };
  },

  // Item que já está em outra roleta sai de lá (uma origem, uma roleta). 422 com
  // `conflict` = a barreira D9 (ver `conflitoDaOrigem`).
  async addOrigin(id: string, origem: NovaOrigem): Promise<RoletaOrigin> {
    const res = await api.post(`${BASE}/${id}/origins`, origem);
    return miolo<{ origin: RoletaOrigin }>(res).origin;
  },

  // Limpa o campo da origem. Não apaga o cadastro do formulário.
  async removeOrigin(id: string, origem: { kind: RoletaOriginKind; ref_id: string }): Promise<void> {
    await api.delete(`${BASE}/${id}/origins`, { data: origem });
  },

  async getHistory(f: RoletaHistoryFilters = {}): Promise<RoletaHistoryItem[]> {
    const url = f.roletaId ? `${BASE}/${f.roletaId}/history` : `${BASE}/history`;
    const res = await api.get(url, {
      params: {
        filter: f.filter ?? 'all',
        user_id: f.userId || undefined,
        days: f.days ?? 7,
      },
    });
    return miolo<{ items?: RoletaHistoryItem[] }>(res).items ?? [];
  },

  async getNextUp(id: string): Promise<RoletaNextUp> {
    const res = await api.get(`${BASE}/${id}/next_up`);
    return miolo<RoletaNextUp>(res);
  },

  // "Cópia de X": desligada, mesmos corretores, prazo e horário, SEM origens.
  async duplicate(id: string): Promise<RoletaConfig> {
    const res = await api.post(`${BASE}/${id}/duplicate`);
    return miolo<RoletaConfig>(res);
  },
};

// Uma instância do servidor compartilhado, como o servidor a descreve.
export interface CentralInstance {
  name: string;
  connected: boolean;
}

export interface CentralInstancesReport {
  instances: CentralInstance[];
  /** Por que a lista está vazia, em português. Nulo quando há instância. */
  reason: string | null;
}

// Modo Leilão: o corretor assume o lead. Primeiro que assumir leva.
// 409 = outro corretor assumiu primeiro (trava anti-empate no banco).
export async function claimConversation(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/claim`);
}
