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

export interface RoletaConfig {
  id: string;
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
  notification_inbox_id: string | null;
  business_hours_config: Record<string, unknown>;
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
  notification_inbox_id?: string | null;
  // Sincronizadas DENTRO de create/update, não numa rota própria: o RBAC deriva
  // a permissão pelo nome da action, então uma action nova exigiria uma
  // permissão que nenhum cargo tem e a tela tomaria 403 sem pista nenhuma.
  //
  // Lista vazia = "não mexe nas instâncias". O backend nunca deixa a roleta sem
  // nenhuma, porque sem instância o sorteio morre calado.
  instances?: Omit<RoletaInstance, 'id' | 'inbox_name' | 'display_name'>[];
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
  | 'sem_membros'
  | 'sem_acesso_ao_inbox'
  | 'roleta_esgotada'
  | 'dono_gravado'
  | 'corretor_sem_whatsapp'
  | 'oferta_cancelada'
  // O lead TEM dono; o que falhou foi abrir o atendimento no número sorteado.
  | 'canal_nao_aberto'
  | 'instancia_divergente'
  | 'dono_falhou'
  | 'erro';

export interface RoletaDiagnostic {
  id: string;
  created_at: string;
  outcome: RoletaOutcome;
  ok: boolean;
  explicacao: string;
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
