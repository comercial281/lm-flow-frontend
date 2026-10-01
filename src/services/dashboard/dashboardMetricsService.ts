import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { DashboardMetrics, Granularity, PeriodPreset, ScopeMode } from '@/pages/Customer/DashboardNova/base/types';
import type { ListaRapidaPayload } from '@/pages/Customer/DashboardNova/types';

export interface DashboardMetricsParams {
  preset?: PeriodPreset;
  /** ISO ou epoch. Só usados quando preset === 'custom'. */
  since?: string;
  until?: string;
  granularity?: Granularity;
  pipeline_id?: string;
  /**
   * PREFERÊNCIA de recorte, não ordem: quem decide é o servidor. Corretor
   * mandando `all` recebe os números dele do mesmo jeito, e o `scope.mode` da
   * resposta diz o que valeu de verdade.
   */
  scope?: ScopeMode;
  /** Filtra por instância (inbox/WhatsApp) — independente do `scope` acima. */
  inbox_id?: string;
  /** Filtra por etiqueta do CRM — independente do `scope` acima. */
  label?: string;
  /** Só leads/conversas atendidos pela IA — independente do `scope` acima. */
  ai_only?: boolean;
  /** Qual IA Vendedora, quando o tenant tem mais de uma. Implica `ai_only`. */
  sales_agent_id?: string;
  /** Só estes blocos, separados por vírgula. Sempre mandar: sem isto, o servidor devolve só período e recorte. */
  blocks?: string;
  /** Um corretor só, para quem vê a imobiliária ou o time. */
  owner_id?: string;
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

/** Os itens por trás de um número da Dashboard (a lista rápida). Mesmos filtros. */
export const fetchDashboardList = async (
  kind: string,
  params: DashboardMetricsParams = {},
): Promise<ListaRapidaPayload> => {
  const response = await api.get('/dashboard/list', { params: { ...params, kind } });
  return extractData<ListaRapidaPayload>(response);
};

export default { fetchDashboardMetrics, fetchDashboardList };
