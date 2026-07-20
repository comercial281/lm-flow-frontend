import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { CustomerDashboardParams } from '@/types/analytics/dashboard';

export interface AutomationsKpiResponse {
  period: { since: number; until: number; days: number };
  followups: {
    sent: number;
    pending: number;
    failed: number;
    cancelled: number;
    /** null quando não houve tentativa no período (não existe taxa de zero) */
    success_rate: number | null;
  };
  first_response: {
    count: number;
    avg_seconds: number | null;
    median_seconds: number | null;
    under_5min_rate: number | null;
    /** ecos automáticos antigos descartados da conta (histórico pré-correção) */
    excluded_automated?: number;
  };
  recovery: {
    recovered: number;
    recovery_rate: number | null;
    /** epoch em que o marco imutável começou a ser gravado; antes disso não há histórico */
    tracked_since: number | null;
  };
  rules: {
    fired: number;
    failed: number;
    active: number;
    /** top 5 por disparo — o total sozinho não distingue volume normal de regra em loop */
    top: { id: string; name: string; fired: number }[];
  };
  reminders: { sent: number; failed: number; skipped: number; available: boolean };
  by_sequence: { id: string; name: string; sent: number }[];
  step_funnel: { position: number; sent: number }[];
}

class AutomationsKpiService {
  async get(params: CustomerDashboardParams = {}): Promise<AutomationsKpiResponse> {
    const response = await api.get('/dashboard/automations', { params });
    return extractData<AutomationsKpiResponse>(response);
  }
}

export const automationsKpiService = new AutomationsKpiService();
