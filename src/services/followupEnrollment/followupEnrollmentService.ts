import api from '@/services/core/api';

export type FollowupAudience = 'all' | 'paid';

export interface FollowupEnrollmentSequenceOption {
  slug: string;
  name: string;
  steps_count: number;
}

export interface FollowupEnrollmentConfig {
  enabled: boolean;
  audience: FollowupAudience;
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
};
