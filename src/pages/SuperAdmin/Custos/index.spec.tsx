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
});
