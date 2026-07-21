import api from '@/services/core/api';

export type NoReplyAudience = 'pipeline' | 'paid' | 'all';

export interface NoReplySequenceOption {
  slug: string;
  name: string;
  steps_count: number;
}

export interface NoReplyRobotConfig {
  enabled: boolean;
  minutes: number;
  scan_window_hours: number;
  audience: NoReplyAudience;
  skip_unnamed: boolean;
  sequence_slug: string | null;
  sequences: NoReplySequenceOption[];
  audiences: { value: NoReplyAudience; label: string }[];
  managed_rule_id: string | null;
  pending_jobs: number;
  sent_24h: number;
  legacy_active_rules: { id: string; name: string }[];
}

export interface NoReplyRobotUpdate {
  enabled: boolean;
  minutes: number;
  scan_window_hours: number;
  audience: NoReplyAudience;
  skip_unnamed: boolean;
  sequence_slug: string | null;
}

const BASE = '/no_reply_robot';

export const noReplyRobotService = {
  async get(): Promise<NoReplyRobotConfig> {
    const res = await api.get(BASE);
    return (res.data as { data: NoReplyRobotConfig }).data;
  },

  async update(data: NoReplyRobotUpdate): Promise<NoReplyRobotConfig> {
    const res = await api.put(BASE, data);
    return (res.data as { data: NoReplyRobotConfig }).data;
  },
};
