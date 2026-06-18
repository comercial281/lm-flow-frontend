import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export type AudienceMode = 'pipeline' | 'stage' | 'manual';
export type BroadcastStatus = 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface BroadcastVariation {
  kind: 'text' | 'image' | 'audio' | 'video';
  text: string;
  media_url?: string;
}

export interface BroadcastCampaign {
  id: string;
  name: string;
  pipeline_id: string | null;
  status: BroadcastStatus;
  variations: BroadcastVariation[];
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_seconds: number;
  business_hours_only: boolean;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  next_run_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface BroadcastAudience {
  mode: AudienceMode;
  stage_id?: string;
  contact_ids?: string[];
}

export interface CreateBroadcastPayload {
  name?: string;
  pipeline_id: string;
  audience: BroadcastAudience;
  variations: BroadcastVariation[];
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_seconds: number;
  business_hours_only: boolean;
}

class BroadcastsService {
  private base = '/broadcasts';

  async list(pipelineId: string): Promise<BroadcastCampaign[]> {
    const res = await api.get(this.base, { params: { pipeline_id: pipelineId } });
    return extractData<BroadcastCampaign[]>(res) || [];
  }

  async create(payload: CreateBroadcastPayload): Promise<BroadcastCampaign> {
    const res = await api.post(this.base, payload);
    return extractData<BroadcastCampaign>(res);
  }

  async audiencePreview(pipelineId: string, audience: BroadcastAudience): Promise<number> {
    const res = await api.post(`${this.base}/audience_preview`, {
      pipeline_id: pipelineId,
      audience,
    });
    return extractData<{ count: number }>(res)?.count ?? 0;
  }

  async pause(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/pause`));
  }

  async resume(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/resume`));
  }

  async cancel(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/cancel`));
  }

  async uploadMedia(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`${this.base}/upload_media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<{ url: string }>(res);
  }

  async testSend(phone: string, variation: BroadcastVariation): Promise<void> {
    await api.post(`${this.base}/test_send`, {
      phone,
      kind: variation.kind,
      text: variation.text,
      media_url: variation.media_url,
    });
  }
}

export const broadcastsService = new BroadcastsService();
