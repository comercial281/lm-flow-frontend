import api from '@/services/core/api';

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
  /** Nome das OUTRAS roletas que atendem por este mesmo número (só leitura). */
  shared_with?: string[];
}

export interface RoletaMember {
  id?: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  weight: number;
  is_active: boolean;
  position: number;
  personal_whatsapp_number: string;
  // Por qual número ESTE corretor atende. O backend devolve os dois; no envio
  // só `inbox_id` importa (é o que ele usa para amarrar a instância).
  roleta_instance_id?: string | null;
  inbox_id?: string | null;
}

// Modo de distribuição. A RoletaConfig é a FONTE ÚNICA: modo + quem + prazo + gestor.
// Os nomes aqui são os mesmos que aparecem na tela, de propósito.
export type DistributionMode = 'rodizio' | 'leilao' | 'manual' | 'disponibilidade';

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
  business_hours_config: RoletaBusinessHours;
  instances?: RoletaInstance[];
  // A FLAG do cliente: pode adicionar um segundo número? Liberada por cliente
  // pela Leal Mídia (nasce desligada).
  multi_instance_enabled?: boolean;
  // O estado REAL, derivado do dado: já tem mais de um número ativo? Os dois são
  // necessários — um decide se aparece o botão de adicionar, o outro decide se
  // aparecem os pesos por instância.
  multi_instancia?: boolean;
  members: RoletaMember[];
  created_at: string;
  updated_at: string;
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
  // ⚠️ Faltava aqui, e era por isso que o horário nunca chegava ao backend: a
  // tela recebia o campo no GET e o descartava no save. Opcional porque roleta
  // sem horário (24h) não manda nada — que é o estado de todas elas hoje.
  business_hours_config?: RoletaBusinessHours;
  // Sincronizadas DENTRO de create/update, não numa rota própria: o RBAC deriva
  // a permissão pelo nome da action, então uma action nova exigiria uma
  // permissão que nenhum cargo tem e a tela tomaria 403 sem pista nenhuma.
  //
  // Lista vazia = "não mexe nas instâncias". O backend nunca deixa a roleta sem
  // nenhuma, porque sem instância o sorteio morre calado.
  instances?: Omit<RoletaInstance, 'id' | 'inbox_name' | 'display_name' | 'shared_with'>[];
  members: Omit<RoletaMember, 'id' | 'user_name' | 'user_avatar' | 'roleta_instance_id'>[];
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
  lead: string;
  lead_telefone: string | null;
  contact_id: string;
  conversation_id: string | null;
  conversation_display_id: number | null;
  corretor: { id: string; nome: string | null };
  instancia: string | null;
  modo: DistributionMode | null;
  atribuido_em: string;
  prazo_minutos: number;
  minutos_restantes: number;
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
  segurando_agora: number;
  ultimo_lead_em: string | null;
}

export interface RoletaQueueConfig {
  id: string;
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

  async getAssignments(status?: string): Promise<BrokerAssignment[]> {
    const params = status ? { status } : {};
    const res = await api.get(`${BASE}/assignments`, { params });
    return (res.data as { data: BrokerAssignment[] }).data ?? [];
  },

  // Dispara um aviso de TESTE (corretor/gestor/grupo) com dados fictícios,
  // usando os valores atuais do formulário — não precisa salvar antes.
  async testNotification(payload: {
    target: 'corretor' | 'gestor' | 'grupo';
    inbox_id: string;
    notification_inbox_id?: string | null;
    gestor_whatsapp_number?: string | null;
    gestor_group_jid?: string | null;
    gestor_group_instance?: string | null;
    timeout_minutes?: number;
    template?: string | null;
  }): Promise<{ sent_to: string }> {
    const res = await api.post(`${BASE}/test_notification`, payload);
    return (res.data as { data: { sent_to: string } }).data;
  },
};

// Modo Leilão: o corretor assume o lead. Primeiro que assumir leva.
// 409 = outro corretor assumiu primeiro (trava anti-empate no banco).
export async function claimConversation(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/claim`);
}
