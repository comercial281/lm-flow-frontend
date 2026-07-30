import api from '@/services/core/api';

export interface RoletaMember {
  id?: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  weight: number;
  is_active: boolean;
  position: number;
  personal_whatsapp_number: string;
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
  notification_inbox_id: string | null;
  business_hours_config: Record<string, unknown>;
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
  notification_inbox_id?: string | null;
  members: Omit<RoletaMember, 'id' | 'user_name' | 'user_avatar'>[];
}

export interface BrokerAssignment {
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  assigned_user: { id: string; name: string | null };
  status: 'pending' | 'accepted' | 'passed' | 'expired';
  assigned_at: string;
  accepted_at: string | null;
  passed_at: string | null;
  timeout_minutes: number;
  round: number;
}

// Uma tentativa de distribuição, com o veredito em português. Alimenta o painel
// "Por que este lead não entrou na roleta?" — que existe porque cada portão do
// caminho formulário → roleta falhava calado num log do servidor.
export type RoletaOutcome =
  | 'sem_config'
  | 'config_sem_roleta'
  | 'roleta_inexistente'
  | 'roleta_inativa'
  | 'modo_manual'
  | 'sem_membros'
  | 'dono_gravado'
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
