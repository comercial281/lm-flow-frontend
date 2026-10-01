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
 *
 * `pendente`: a resposta em mãos NÃO é a dos filtros pedidos agora. Calculado
 * no render, então já vale no render em que o filtro muda, antes de o efeito
 * pôr `carregando` em true (o seletor de Corretor não pisca "Todos"). Depois de
 * um erro continua true: os números na tela são da última resposta, não destes
 * filtros.
 *
 * Sem bloco nenhum não há pedido: `blocks=` vazio o servidor leria como "tudo".
 */
export function useDashboardNova(filtros: FiltrosDashboard, blocos: string[]) {
  const chaveFiltros = JSON.stringify(paramsDaApi(filtros));
  const chaveBlocos = blocos.join(',');
  const chavePedido = `${chaveFiltros}|${chaveBlocos}`;
  const temBlocos = chaveBlocos.length > 0;

  // A resposta guarda a chave do pedido que a gerou.
  const [resposta, setResposta] = useState<{ dados: DashboardNovaPayload; chave: string } | null>(null);
  const [carregando, setCarregando] = useState(temBlocos);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const recarregar = useCallback(async () => {
    abortRef.current?.abort();
    if (!chaveBlocos) {
      abortRef.current = null;
      setCarregando(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const chave = `${chaveFiltros}|${chaveBlocos}`;
    setCarregando(true);
    setErro(null);
    try {
      const payload = await fetchDashboardMetrics(
        { ...JSON.parse(chaveFiltros), blocks: chaveBlocos },
        controller.signal,
      );
      if (!controller.signal.aborted) setResposta({ dados: payload as unknown as DashboardNovaPayload, chave });
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

  const dados = resposta?.dados ?? null;
  const pendente = temBlocos && (carregando || resposta?.chave !== chavePedido);

  return { dados, carregando, pendente, erro, recarregar };
}
