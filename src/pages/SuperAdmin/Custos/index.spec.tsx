import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: vi.fn() } }));

import Custos from './index';
import { fakeSummary } from './fakeSummary';

function renderPage() {
  return render(<MemoryRouter><Custos /></MemoryRouter>);
}

describe('Custos', () => {
  beforeEach(() => {
    apiGet.mockReset();
    // o mês padrão é o de hoje: fixa a data pra o teste não depender do dia em que roda
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('mostra o total e os cartões do mês em R$', async () => {
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { success: true, data: url.includes('summary') ? fakeSummary() : { items: [], meta: { total: 0, page: 1, per_page: 50 } } } }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    expect(screen.getByText(/1\.300,00/)).toBeInTheDocument();
    expect(screen.getByText('Railway')).toBeInTheDocument();
  });

  it('erro aparece como erro, com tentar de novo — nunca como vazio', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument());
  });

  it('com cliente filtrado, a estrutura avisa que não é dividida e sai do total', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (!url.includes('summary')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t, totals: { ai_brl: 50, ai_usd: 10, structure_brl: 0, total_brl: 50, calls: 10, errors: 0, unpriced: 0 } } : {}) } });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    await waitFor(() => expect(screen.getAllByText('não é dividida por cliente').length).toBe(3));
    expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a' } });
  });

  function filtrado(total: number) {
    return fakeSummary({ tenant: 'tenant_a', totals: { ai_brl: total, ai_usd: 1, structure_brl: 0, total_brl: total, calls: 1, errors: 0, unpriced: 0 } });
  }

  it('enquanto o filtro novo carrega, o resumo antigo some (skeleton)', async () => {
    let resolver: (v: unknown) => void = () => {};
    apiGet.mockImplementation((_u: string, cfg?: { params?: Record<string, string> }) =>
      _u.includes('/calls') ? Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } }) :
      cfg?.params?.tenant
        ? new Promise((r) => { resolver = r; })
        : Promise.resolve({ data: { success: true, data: fakeSummary() } }));
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText(/1\.300,00/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.queryByText(/1\.300,00/)).not.toBeInTheDocument();
    resolver({ data: { success: true, data: filtrado(77) } });
    await waitFor(() => expect(screen.getAllByText(/77,00/).length).toBeGreaterThan(0));
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('resposta fora de ordem não sobrescreve a mais recente', async () => {
    const pend: Record<string, (v: unknown) => void> = {};
    apiGet.mockImplementation((_u: string, cfg?: { params?: Record<string, string> }) => {
      if (_u.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant;
      if (!t) return Promise.resolve({ data: { success: true, data: fakeSummary() } });
      return new Promise((r) => { pend[t] = r; });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/1\.300,00/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    await waitFor(() => expect(pend.tenant_a).toBeDefined());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'public' } });
    await waitFor(() => expect(pend.public).toBeDefined());
    pend.public({ data: { success: true, data: { ...filtrado(22), tenant: 'public' } } });
    await waitFor(() => expect(screen.getAllByText(/22,00/).length).toBeGreaterThan(0));
    pend.tenant_a({ data: { success: true, data: filtrado(99) } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/99,00/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/22,00/).length).toBeGreaterThan(0);
  });
});
