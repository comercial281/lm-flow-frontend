import api from '@/services/core/api';
import type { CallFilters, CostCallDetail, CostCallsPage, CostsSummary, Invoice, InvoiceInput } from '@/types/admin/costs';

interface Envelope<T> { success: boolean; data: T }

export const costsService = {
  async summary({ month, tenant }: { month: string; tenant: string | null }): Promise<CostsSummary> {
    const params: Record<string, string> = { month };
    if (tenant) params.tenant = tenant;
    const res = await api.get('/super/costs/summary', { params });
    return (res.data as Envelope<CostsSummary>).data;
  },

  async calls(f: CallFilters): Promise<CostCallsPage> {
    const params: Record<string, string | number> = { month: f.month };
    if (f.tenant) params.tenant = f.tenant;
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
};
