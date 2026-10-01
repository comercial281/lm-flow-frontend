import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDashboardMetrics, type DashboardMetricsParams } from '@/services/dashboard/dashboardMetricsService';
import type { DashboardNovaPayload, FiltrosDashboard } from './types';

/** Os filtros da tela no formato que a API entende. Sem filtro, sem chave. */
export function paramsDaApi(f: FiltrosDashboard): DashboardMetricsParams {
  return {
    preset: f.preset,
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.ownerId ? { owner_id: f.ownerId } : {}),
    ...(f.inboxId ? { inbox_id: f.inboxId } : {}),
    ...(f.labelId ? { label: f.labelId } : {}),
    ...(f.aiOnly ? { ai_only: true } : {}),
    ...(f.salesAgentId ? { sales_agent_id: f.salesAgentId } : {}),
    ...(f.pipelineId ? { pipeline_id: f.pipelineId } : {}),
  };
}

/**
 * Um pedido só, com `blocks=`: todos os blocos dividem o MESMO período
 * resolvido no servidor. O pedido anterior é abortado quando o filtro muda
 * (senão a resposta velha chega depois e sobrescreve a nova).
 */
export function useDashboardNova(filtros: FiltrosDashboard, blocos: string[]) {
  const [dados, setDados] = useState<DashboardNovaPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chaveFiltros = JSON.stringify(paramsDaApi(filtros));
  const chaveBlocos = blocos.join(',');

  const recarregar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCarregando(true);
    setErro(null);
    try {
      const payload = await fetchDashboardMetrics(
        { ...JSON.parse(chaveFiltros), blocks: chaveBlocos },
        controller.signal,
      );
      if (!controller.signal.aborted) setDados(payload as unknown as DashboardNovaPayload);
    } catch (e) {
      const abortado =
        controller.signal.aborted ||
        (e as { code?: string })?.code === 'ERR_CANCELED' ||
        (e as { name?: string })?.name === 'CanceledError';
      if (!abortado) setErro('Não consegui carregar a Dashboard.');
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
    }
  }, [chaveFiltros, chaveBlocos]);

  useEffect(() => {
    recarregar();
    return () => abortRef.current?.abort();
  }, [recarregar]);

  return { dados, carregando, erro, recarregar };
}
