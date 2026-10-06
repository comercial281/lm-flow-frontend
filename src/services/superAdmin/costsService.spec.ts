import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: apiPut } }));

import { costsService } from './costsService';

describe('costsService', () => {
  beforeEach(() => { apiGet.mockReset(); apiPut.mockReset(); });

  it('resumo manda mês e cliente só quando há cliente', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { month: '2026-10' } } });
    await costsService.summary({ month: '2026-10', tenant: null });
    expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', { params: { month: '2026-10' } });
    await costsService.summary({ month: '2026-10', tenant: 'tenant_a' });
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a' } });
  });

  it('chamadas: "só erros" vira status=error e filtros vazios não vão', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
    await costsService.calls({ month: '2026-10', tenant: null, feature: '', provider: 'openai', onlyErrors: true, page: 2 });
    expect(apiGet).toHaveBeenCalledWith('/super/costs/calls', {
      params: { month: '2026-10', per_page: 20, provider: 'openai', status: 'error', page: 2 },
    });
  });

  it('salvar faturas faz PUT com o mês', async () => {
    apiPut.mockResolvedValue({ data: { success: true, data: { month: '2026-10', invoices: [] } } });
    await costsService.saveInvoices('2026-10', [{ provider: 'railway', amount_usd: '80', note: '' }]);
    expect(apiPut).toHaveBeenCalledWith('/super/costs/invoices', {
      month: '2026-10', invoices: [{ provider: 'railway', amount_usd: '80', note: '' }],
    });
  });

  it('IA só vai junto do cliente, no resumo e na lista', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { month: '2026-10', items: [], meta: {} } } });
    await costsService.summary({ month: '2026-10', tenant: null, agent: 'ag1' });
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/summary', { params: { month: '2026-10' } });
    await costsService.summary({ month: '2026-10', tenant: 'tenant_a', agent: 'ag1' });
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a', agent: 'ag1' } });
    await costsService.calls({ month: '2026-10', tenant: 'tenant_a', agent: 'ag1', feature: '', provider: '', onlyErrors: false, page: 1 });
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'tenant_a', agent: 'ag1' } });
  });

  it('câmbio das contas: lê e grava', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { value: 5.46, source: 'default', default_value: 5.46 } } });
    apiPut.mockResolvedValue({ data: { success: true, data: { value: 5.3, source: 'accounting', default_value: 5.46 } } });
    expect((await costsService.cambio()).value).toBe(5.46);
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/rate');
    expect((await costsService.salvarCambio('5,30')).value).toBe(5.3);
    expect(apiPut).toHaveBeenLastCalledWith('/super/costs/rate', { value: '5,30' });
  });
});
