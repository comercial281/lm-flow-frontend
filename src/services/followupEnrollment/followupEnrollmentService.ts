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
