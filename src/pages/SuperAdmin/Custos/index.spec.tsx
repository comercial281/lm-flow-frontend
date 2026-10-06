import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: vi.fn() } }));
// O câmbio e a margem têm testes próprios; aqui só o resumo e a lista.
const margemRecarga = vi.hoisted(() => vi.fn());
vi.mock('./CambioDasContas', () => ({
  default: ({ aoMudar }: { aoMudar: () => void }) => <button onClick={aoMudar}>mudou-cambio</button>,
}));
vi.mock('./Margem', () => ({
  default: ({ recarga, kind, aoMudarKind }: { recarga: number; kind: string; aoMudarKind: (k: string) => void }) => {
    margemRecarga(recarga);
    return <div><p>margem-aqui</p><span>{kind}</span><button onClick={() => aoMudarKind('avulso')}>so-avulso</button></div>;
  },
}));

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

  it('abre filtrado pelo endereço: cliente e só erros', async () => {
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { success: true, data: url.includes('summary') ? fakeSummary() : { items: [], meta: { total: 0, page: 1, per_page: 50 } } } }));
    render(<MemoryRouter initialEntries={['/admin/clientes/custos?tenant=tenant_a&so_erros=1']}><Custos /></MemoryRouter>);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', expect.objectContaining({ params: expect.objectContaining({ tenant: 'tenant_a' }) })));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/calls', expect.objectContaining({ params: expect.objectContaining({ status: 'error' }) })));
  });

  it('o filtro Avulso/Performance da Margem sobrevive à troca de mês', async () => {
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { success: true, data: url.includes('summary') ? fakeSummary() : { items: [], meta: { total: 0, page: 1, per_page: 50 } } } }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'so-avulso' }));
    expect(screen.getByText('avulso')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } });
    await screen.findByText('margem-aqui');
    expect(screen.getByText('avulso')).toBeInTheDocument();
  });

  it('"só erros" do endereço vale só na primeira carga: desmarcado, trocar o mês não liga de novo', async () => {
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { success: true, data: url.includes('summary') ? fakeSummary() : { items: [], meta: { total: 0, page: 1, per_page: 50 } } } }));
    render(<MemoryRouter initialEntries={['/admin/clientes/custos?so_erros=1']}><Custos /></MemoryRouter>);
    const caixa = await screen.findByLabelText('Só erros');
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', expect.objectContaining({ params: expect.objectContaining({ status: 'error' }) })));
    fireEvent.click(caixa);
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20 } }));
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } });
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-09', per_page: 20 } }));
    expect(screen.getByLabelText('Só erros')).not.toBeChecked();
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

  it('com cliente escolhido aparece o filtro IA, e ele vai junto no resumo e na lista', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t, agents: [{ id: 'ag1', name: 'Sara' }] } : {}) } });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    expect(screen.queryByLabelText('IA')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    fireEvent.change(await screen.findByLabelText('IA'), { target: { value: 'ag1' } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a', agent: 'ag1' } }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'tenant_a', agent: 'ag1' } }));
  });

  it('trocar de cliente limpa a IA escolhida', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t, agents: [{ id: 'ag1', name: 'Sara' }] } : {}) } });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    fireEvent.change(await screen.findByLabelText('IA'), { target: { value: 'ag1' } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a', agent: 'ag1' } }));
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'public' } });
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'public' } }));
  });

  it('IA escolhida que não está mais nas opções do cliente volta para Todas as IAs', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      const a = cfg?.params?.agent ?? null;
      // Servidor ecoa o id pedido em `agent`, mesmo sem ele estar em `agents` (IA apagada).
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t, agent: a, agents: [{ id: 'ag1', name: 'Sara' }, { id: 'ag2', name: 'Beto' }] } : {}) } });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    const seletor = await screen.findByLabelText('IA');
    // Simula a IA ter sido apagada: o mock devolve só ag1 daqui pra frente.
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      return Promise.resolve({ data: { success: true, data: fakeSummary({ tenant: cfg?.params?.tenant ?? null, agent: cfg?.params?.agent ?? null, agents: [{ id: 'ag1', name: 'Sara' }] }) } });
    });
    fireEvent.change(seletor, { target: { value: 'ag2' } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a', agent: 'ag2' } }));
    await waitFor(() => expect((screen.getByLabelText('IA') as HTMLSelectElement).value).toBe('__todas__'));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'tenant_a' } }));
  });

  it('mudar o câmbio recarrega o resumo e a lista, com os mesmos filtros', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t, agent: cfg?.params?.agent ?? null, agents: [{ id: 'ag1', name: 'Sara' }] } : {}) } });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total do mês')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    fireEvent.change(await screen.findByLabelText('IA'), { target: { value: 'ag1' } });
    const sumario = ['/super/costs/summary', { params: { month: '2026-10', tenant: 'tenant_a', agent: 'ag1' } }];
    const lista = ['/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'tenant_a', agent: 'ag1' } }];
    await waitFor(() => expect(apiGet.mock.calls.filter((c) => JSON.stringify(c) === JSON.stringify(lista))).toHaveLength(1));
    const conta = (alvo: unknown) => apiGet.mock.calls.filter((c) => JSON.stringify(c) === JSON.stringify(alvo)).length;
    await new Promise((r) => setTimeout(r, 50)); // deixa assentar as buscas da escolha da IA
    const antesResumo = conta(sumario);
    const antesLista = conta(lista);
    fireEvent.click(screen.getByText('mudou-cambio'));
    await waitFor(() => expect(conta(sumario)).toBeGreaterThan(antesResumo));
    await waitFor(() => expect(conta(lista)).toBeGreaterThan(antesLista));
    expect((screen.getByLabelText('IA') as HTMLSelectElement).value).toBe('ag1');
  });

  it('a margem aparece em "Todos os clientes" e some com cliente filtrado', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, string> }) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      const t = cfg?.params?.tenant ?? null;
      return Promise.resolve({ data: { success: true, data: fakeSummary(t ? { tenant: t } : {}) } });
    });
    renderPage();
    expect(await screen.findByText('margem-aqui')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'tenant_a' } });
    await waitFor(() => expect(screen.queryByText('margem-aqui')).not.toBeInTheDocument());
  });

  it('mudar o câmbio recarrega a margem (recarga sobe)', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/calls')) return Promise.resolve({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 50 } } } });
      return Promise.resolve({ data: { success: true, data: fakeSummary() } });
    });
    margemRecarga.mockClear();
    renderPage();
    await screen.findByText('margem-aqui');
    fireEvent.click(screen.getByText('mudou-cambio'));
    await waitFor(() => expect(margemRecarga).toHaveBeenCalledWith(1));
  });
});
