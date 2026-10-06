import api from '@/services/core/api';
import type { AccountingRate, CallFilters, CostCallDetail, CostCallsPage, CostsSummary, Invoice, InvoiceInput } from '@/types/admin/costs';

interface Envelope<T> { success: boolean; data: T }

// Linhas por página na lista de chamadas. 20 e não os 50 do servidor: a lista
// fica no fim da tela de Custos, embaixo dos cartões e recortes (Tony, 03/10).
export const CHAMADAS_POR_PAGINA = 20;

export const costsService = {
  async summary({ month, tenant, agent }: { month: string; tenant: string | null; agent?: string | null }): Promise<CostsSummary> {
    const params: Record<string, string> = { month };
    if (tenant) params.tenant = tenant;
    // A IA só filtra com cliente: o turno que liga chamada e IA mora no schema dele.
    if (tenant && agent) params.agent = agent;
    const res = await api.get('/super/costs/summary', { params });
    return (res.data as Envelope<CostsSummary>).data;
  },

  async calls(f: CallFilters): Promise<CostCallsPage> {
    const params: Record<string, string | number> = { month: f.month, per_page: CHAMADAS_POR_PAGINA };
    if (f.tenant) params.tenant = f.tenant;
    if (f.tenant && f.agent) params.agent = f.agent;
    if (f.feature) params.feature = f.feature;
    if (f.provider) params.provider = f.provider;
    if (f.onlyErrors) params.status = 'error';
    if (f.page > 1) params.page = f.page;
    const res = await api.get('/super/costs/calls', { params });
    return (res.data as Envelope<CostCallsPage>).data;
  },

  async call(id: string): Promise<CostCallDetail> {
    const res = await api.get(`/super/costs/calls/${id}`);
    return (res.data as Envelope<CostCallDetail>).data;
  },

  async invoices(month: string): Promise<Invoice[]> {
    const res = await api.get('/super/costs/invoices', { params: { month } });
    return (res.data as Envelope<{ month: string; invoices: Invoice[] }>).data.invoices;
  },

  async saveInvoices(month: string, invoices: InvoiceInput[]): Promise<Invoice[]> {
    const res = await api.put('/super/costs/invoices', { month, invoices });
    return (res.data as Envelope<{ month: string; invoices: Invoice[] }>).data.invoices;
  },

  async cambio(): Promise<AccountingRate> {
    const res = await api.get('/super/costs/rate');
    return (res.data as Envelope<AccountingRate>).data;
  },

  async salvarCambio(valor: string): Promise<AccountingRate> {
    const res = await api.put('/super/costs/rate', { value: valor });
    return (res.data as Envelope<AccountingRate>).data;
  },
};
