import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const fetchMetrics = vi.fn();
vi.mock('@/services/dashboard/dashboardMetricsService', () => ({
  fetchDashboardMetrics: (...args: unknown[]) => fetchMetrics(...args),
}));

import { paramsDaApi, useDashboardNova } from './useDashboardNova';

describe('useDashboardNova', () => {
  // Chaves: o beforeEach que devolve função a roda como limpeza, e o mock rejeitado derrubava o teste.
  beforeEach(() => {
    fetchMetrics.mockReset();
  });

  it('traduz os filtros da tela para o pedido', () => {
    expect(paramsDaApi({ preset: 'last_7_days', scope: 'mine', ownerId: 'u1', inboxId: 'i1', labelId: 'l1', aiOnly: true, pipelineId: 'p1' }))
      .toEqual({ preset: 'last_7_days', scope: 'mine', owner_id: 'u1', inbox_id: 'i1', label: 'l1', ai_only: true, pipeline_id: 'p1' });
    expect(paramsDaApi({ preset: 'last_7_days' })).toEqual({ preset: 'last_7_days' });
  });

  it('pede só os blocos da tela, num pedido só', async () => {
    fetchMetrics.mockResolvedValue({ period: {}, scope: { mode: 'all' } });
    const { result } = renderHook(() => useDashboardNova({ preset: 'last_7_days' }, ['kpis', 'pending']));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(fetchMetrics).toHaveBeenCalledTimes(1);
    expect(fetchMetrics.mock.calls[0][0]).toEqual({ preset: 'last_7_days', blocks: 'kpis,pending' });
    expect(result.current.dados?.scope.mode).toBe('all');
  });

  it('erro de rede vira mensagem, nunca tela zerada', async () => {
    fetchMetrics.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useDashboardNova({ preset: 'last_7_days' }, ['kpis']));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe('Não consegui carregar a Dashboard.');
    expect(result.current.dados).toBeNull();
  });
});
