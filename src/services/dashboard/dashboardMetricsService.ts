import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { DashboardMetrics, Granularity, PeriodPreset } from '@/pages/Customer/DashboardV2/types';

export interface DashboardMetricsParams {
  preset?: PeriodPreset;
  /** ISO ou epoch. Só usados quando preset === 'custom'. */
  since?: string;
  until?: string;
  granularity?: Granularity;
  pipeline_id?: string;
}

/**
 * Busca o payload inteiro do dashboard novo numa request só.
 *
 * Um endpoint em vez de um por bloco: assim todos os blocos compartilham o mesmo
 * período resolvido no servidor e nunca discordam sobre qual é "este mês". O
 * front não calcula data nenhuma.
 */
export const fetchDashboardMetrics = async (
  params: DashboardMetricsParams = {},
  signal?: AbortSignal,
): Promise<DashboardMetrics> => {
  const response = await api.get('/dashboard/metrics', { params, signal });
  return extractData<DashboardMetrics>(response);
};

export default { fetchDashboardMetrics };
