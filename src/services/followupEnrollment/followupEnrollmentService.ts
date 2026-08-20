import api from '@/services/core/api';

/** 'stage' = o funil começa quando o card entra numa coluna escolhida. */
export type FollowupAudience = 'all' | 'paid' | 'stage';

export interface FollowupEnrollmentSequenceOption {
  slug: string;
  name: string;
  steps_count: number;
}

/** Roteamento por origem: pra qual funil vai o lead de anúncio e o do orgânico. */
export interface FollowupRoutingOption {
  key: 'paid' | 'organic';
  label: string;
  sequence_slug: string | null;
  /** A regra existe e está ativa. Desativada, a escolha está gravada e não vale nada. */
  enabled: boolean;
  exists: boolean;
}

export interface FollowupStageOption {
  id: string;
  name: string;
  pipeline_id: string;
  pipeline_name: string | null;
}

export interface FollowupEnrollmentConfig {
  enabled: boolean;
  audience: FollowupAudience;
  /** Pra qual funil vai cada origem de lead. */
  routing: FollowupRoutingOption[];
  /** Coluna escolhida quando a audiência é 'stage'. */
  stage_id: string | null;
  /** Todas as colunas do CRM, com o nome do pipeline pra agrupar na tela. */
  stages: FollowupStageOption[];
  sequence_slug: string | null;
  sequences: FollowupEnrollmentSequenceOption[];
  audiences: { value: FollowupAudience; label: string }[];
  managed_rule_id: string | null;
  /** Regras de follow-up ativas criadas fora deste painel (seed/script). Se houver,
   *  o follow-up dispara mesmo com o botão daqui desligado — a tela avisa. */
  external_active_rules?: { id: string; name: string; trigger: string }[];
  /** Disparos agendados cancelados no último desligamento. */
  cancelled_jobs?: number;
  /** Disparos ainda na fila. */
  pending_jobs?: number;
}

export interface FollowupEnrollmentUpdate {
  enabled: boolean;
  audience: FollowupAudience;
  sequence_slug: string;
  /** Obrigatório só quando a audiência é 'stage' e está LIGANDO. */
  stage_id?: string | null;
}

const BASE = '/followup_enrollment';

export const followupEnrollmentService = {
  async get(): Promise<FollowupEnrollmentConfig> {
    const res = await api.get(BASE);
    return (res.data as { data: FollowupEnrollmentConfig }).data;
  },

  async update(data: FollowupEnrollmentUpdate): Promise<FollowupEnrollmentConfig> {
    const res = await api.put(BASE, data);
    return (res.data as { data: FollowupEnrollmentConfig }).data;
  },

  /** Troca o funil de destino por origem. Manda só o que mudou.
   *  `missing_rules` lista as origens cuja regra não existe neste CRM. */
  async updateRouting(data: { paid?: string; organic?: string }): Promise<{
    config: FollowupEnrollmentConfig;
    missingRules: string[];
  }> {
    const res = await api.put(`${BASE}/routing`, data);
    const body = res.data as { data: FollowupEnrollmentConfig; missing_rules?: string[] };
    return { config: body.data, missingRules: body.missing_rules ?? [] };
  },
};
