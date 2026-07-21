import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDashboardMetrics } from '@/services/dashboard/dashboardMetricsService';
import type { DashboardMetrics, PeriodPreset } from '../types';

export interface DashboardFilters {
  preset: PeriodPreset;
  since?: string;
  until?: string;
  pipelineId?: string;
}

/**
 * Carrega o payload do dashboard.
 *
 * Cuidados que já morderam antes neste repo:
 * - `loading` NÃO entra nas deps do efeito, senão o setState dele reagenda o
 *   próprio efeito e a tela trava em "Carregando".
 * - request anterior é abortada quando o filtro muda: sem isso, trocar de
 *   período rápido faz a resposta antiga chegar depois e sobrescrever a nova.
 */
export function useDashboardMetrics(filters: DashboardFilters) {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { preset, since, until, pipelineId } = filters;

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchDashboardMetrics(
        {
          preset,
          ...(preset === 'custom' && since ? { since } : {}),
          ...(preset === 'custom' && until ? { until } : {}),
          ...(pipelineId ? { pipeline_id: pipelineId } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setData(payload);
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err as { code?: string; name?: string })?.code === 'ERR_CANCELED' ||
        (err as { name?: string })?.name === 'CanceledError';
      if (!aborted) setError('Não foi possível carregar as métricas.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [preset, since, until, pipelineId]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { data, loading, error, reload: load };
}
