import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FiltrosDashboard } from './types';

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

  it('os mesmos filtros num objeto novo não refazem o pedido', async () => {
    fetchMetrics.mockResolvedValue({ period: {}, scope: { mode: 'all' } });
    const { result, rerender } = renderHook(({ f }) => useDashboardNova(f, ['kpis']), {
      initialProps: { f: { preset: 'last_7_days' } as FiltrosDashboard },
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    rerender({ f: { preset: 'last_7_days', pipelineId: undefined } });
    rerender({ f: { preset: 'last_7_days' } });
    expect(fetchMetrics).toHaveBeenCalledTimes(1);
  });

  it('lista de blocos vazia não vira pedido com blocks= vazio', () => {
    const { result } = renderHook(() => useDashboardNova({ preset: 'last_7_days' }, []));
    expect(fetchMetrics).not.toHaveBeenCalled();
    expect(result.current.carregando).toBe(false);
    expect(result.current.pendente).toBe(false);
  });

  it('pendente: já no render em que o filtro muda, antes de o pedido sair', async () => {
    fetchMetrics.mockResolvedValueOnce({ period: {}, scope: { mode: 'all', owner_id: null } });
    const vistos: { carregando: boolean; pendente: boolean }[] = [];
    const { result, rerender } = renderHook(
      ({ f }) => {
        const r = useDashboardNova(f, ['kpis']);
        vistos.push({ carregando: r.carregando, pendente: r.pendente });
        return r;
      },
      { initialProps: { f: { preset: 'last_7_days' } as FiltrosDashboard } },
    );
    await waitFor(() => expect(result.current.pendente).toBe(false));

    let soltar: (v: unknown) => void = () => {};
    fetchMetrics.mockImplementationOnce(() => new Promise(r => { soltar = r; }));
    vistos.length = 0;
    rerender({ f: { preset: 'last_7_days', ownerId: 'u1' } });
    // O primeiro render com o filtro novo ainda tem carregando = false (o efeito não rodou).
    expect(vistos[0]).toEqual({ carregando: false, pendente: true });
    expect(result.current.pendente).toBe(true);

    await act(async () => { soltar({ period: {}, scope: { mode: 'all', owner_id: 'u1' } }); });
    expect(result.current.pendente).toBe(false);
    expect(result.current.dados?.scope.owner_id).toBe('u1');
  });

  it('erro depois de uma resposta boa guarda os números de antes e continua pendente', async () => {
    fetchMetrics.mockResolvedValueOnce({ period: {}, scope: { mode: 'all' } });
    const { result, rerender } = renderHook(({ f }) => useDashboardNova(f, ['kpis']), {
      initialProps: { f: { preset: 'last_7_days' } as FiltrosDashboard },
    });
    await waitFor(() => expect(result.current.dados).not.toBeNull());

    fetchMetrics.mockRejectedValueOnce(new Error('rede'));
    rerender({ f: { preset: 'last_30_days' } });
    await waitFor(() => expect(result.current.erro).toBe('Não consegui carregar a Dashboard.'));
    expect(result.current.dados?.scope.mode).toBe('all');
    expect(result.current.carregando).toBe(false);
    // A resposta em mãos não é a do filtro pedido.
    expect(result.current.pendente).toBe(true);
  });
});
