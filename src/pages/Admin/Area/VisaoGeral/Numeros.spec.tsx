import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet } }));
// recharts precisa de tamanho de verdade; no jsdom o gráfico não importa pro teste.
vi.mock('./GraficoDoPeriodo', () => ({ default: () => <div data-testid="grafico" /> }));

import Numeros from './Numeros';

const totais = { leads: 30, conversations: 20, users_active: 8, ai_attended: 10, ai_visits: 2, ai_cost_brl: 150 };
const resposta = (extra: Record<string, unknown> = {}, totaisExtra: Record<string, unknown> = {}) => ({ data: { success: true, data: {
  generated_at: new Date().toISOString(),
  period: { key: '7d', bucket: 'day', starts_at: '', ends_at: '', prev_starts_at: '', prev_ends_at: '' },
  tenants: [{ schema: 'tenant_a', name: 'Alfa' }, { schema: 'tenant_b', name: 'Beta' }],
  totals: { ...totais, users_total: 12, users_missing: 3 },
  previous_totals: { ...totais, leads: 25, ...totaisExtra },
  series: [{ bucket: '2026-10-15', leads: 3, conversations: 2 }],
  clients: [
    { schema: 'tenant_a', name: 'Alfa', readable: true, ai_cost_brl: 100, leads: 10, conversations: 5, users_active: 4, users_total: 9, users_missing: 2, ai_attended: 6, ai_visits: 1 },
    { schema: 'tenant_b', name: 'Beta', readable: true, ai_cost_brl: 50, leads: 20, conversations: 15, users_active: 4, users_total: 3, users_missing: 1, ai_attended: 4, ai_visits: 1 },
  ],
  structure: null, unreadable: [], ...extra,
} } });

const montar = (url = '/admin/numeros') => render(<MemoryRouter initialEntries={[url]}><Numeros /></MemoryRouter>);

describe('Números', () => {
  beforeEach(() => apiGet.mockReset());

  it('cartões com variação e tabela ordenada por leads', async () => {
    apiGet.mockResolvedValue(resposta());
    montar();
    await screen.findByRole('button', { name: 'Alfa' });
    expect(apiGet).toHaveBeenCalledWith('/super/overview/numbers', { params: { periodo: '7d' } });
    expect(screen.getByText('+20%')).toBeInTheDocument();          // leads 30 vs 25
    expect(screen.getByText(/3 sumidas há 7\+ dias/)).toBeInTheDocument();
    const linhas = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(linhas).toEqual(['Beta', 'Alfa']);
  });

  it('custo da IA subindo fica em cor neutra; leads subindo fica verde', async () => {
    apiGet.mockResolvedValue(resposta({}, { ai_cost_brl: 100 })); // 150 vs 100 = +50%
    montar();
    const custo = await screen.findByText('+50%');
    expect(custo.className).toContain('text-muted-foreground');
    expect(custo.className).not.toContain('emerald');
    expect(screen.getByText('+20%').className).toContain('emerald');
  });

  it('período e cliente vão para a consulta; clicar no cliente filtra', async () => {
    apiGet.mockResolvedValue(resposta());
    montar('/admin/numeros?periodo=hoje');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/overview/numbers', { params: { periodo: 'hoje' } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alfa' }));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/overview/numbers', { params: { periodo: 'hoje', tenant: 'tenant_a' } }));
  });

  it('cliente ilegível: linha marcada e total avisa', async () => {
    apiGet.mockResolvedValue(resposta({
      clients: [{ schema: 'tenant_a', name: 'Alfa', readable: false, ai_cost_brl: 100 }],
      unreadable: [{ name: 'Alfa', message: 'não deu tempo de ler' }],
    }));
    montar();
    await waitFor(() => expect(screen.getAllByText('não deu pra ler').length).toBeGreaterThan(0));
    expect(screen.getByText(/sem 1 cliente/)).toBeInTheDocument();
  });

  it('Atualizar força nova leitura', async () => {
    apiGet.mockResolvedValue(resposta());
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/overview/numbers', { params: { periodo: '7d', refresh: '1' } }));
  });

  it('Atualizar fica ocupado enquanto lê e volta ao terminar', async () => {
    let soltar: (v: unknown) => void = () => {};
    apiGet
      .mockResolvedValueOnce(resposta())
      .mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));
    const ocupado = await screen.findByRole('button', { name: 'Atualizando…' });
    expect(ocupado).toBeDisabled();
    fireEvent.click(ocupado);
    expect(apiGet).toHaveBeenCalledTimes(2);
    soltar(resposta());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Atualizar' })).toBeEnabled());
  });

  it('Atualizar volta a funcionar depois de erro', async () => {
    apiGet.mockResolvedValueOnce(resposta()).mockRejectedValueOnce(new Error('caiu'));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Atualizando…' })).not.toBeInTheDocument();
  });

  it('sem nenhum cliente lido, os cartões mostram "—" (nunca zero) e o custo fica', async () => {
    apiGet.mockResolvedValue(resposta({
      totals: { leads: 0, conversations: 0, users_active: 0, ai_attended: 0, ai_visits: 0, ai_cost_brl: 150, users_total: 0, users_missing: 0 },
      clients: [{ schema: 'tenant_a', name: 'Alfa', readable: false, ai_cost_brl: 100 }],
      unreadable: [{ name: 'Alfa', message: 'não deu tempo de ler' }],
    }));
    montar();
    const cartao = (rotulo: string) => screen.getAllByText(rotulo).map((el) => el.parentElement as HTMLElement).find((el) => el.className.includes('bg-card')) as HTMLElement;
    await waitFor(() => expect(cartao('Leads')).toBeTruthy());
    for (const rotulo of ['Leads', 'Conversas', 'Usuários ativos', 'Atendidos pela IA', 'Visitas pela IA']) {
      expect(within(cartao(rotulo)).getByText('—')).toBeInTheDocument();
      expect(within(cartao(rotulo)).queryByText(/%/)).not.toBeInTheDocument();
    }
    expect(within(cartao('Usuários ativos')).queryByText(/sumida/)).not.toBeInTheDocument();
    expect(within(cartao('Custo da IA')).getByText(/150/)).toBeInTheDocument();
  });

  it('sem nenhum cliente lido e sem custo, o custo também é "—"', async () => {
    apiGet.mockResolvedValue(resposta({
      totals: { leads: 0, conversations: 0, users_active: 0, ai_attended: 0, ai_visits: 0, ai_cost_brl: null },
      clients: [{ schema: 'tenant_a', name: 'Alfa', readable: false, ai_cost_brl: null }],
      unreadable: [{ name: 'Alfa', message: 'x' }, { name: 'Custo da IA', message: 'y' }],
    }));
    montar();
    const cartao = (rotulo: string) => screen.getAllByText(rotulo).map((el) => el.parentElement as HTMLElement).find((el) => el.className.includes('bg-card')) as HTMLElement;
    await waitFor(() => expect(cartao('Custo da IA')).toBeTruthy());
    expect(within(cartao('Custo da IA')).getByText('—')).toBeInTheDocument();
  });

  it('resposta atrasada de período antigo não sobrescreve a nova', async () => {
    let soltarVelha: (v: unknown) => void = () => {};
    apiGet
      .mockImplementationOnce(() => new Promise((r) => { soltarVelha = r; }))
      .mockResolvedValueOnce(resposta({ clients: [{ schema: 'tenant_b', name: 'Nova', readable: true, ai_cost_brl: 0, leads: 1, conversations: 0, users_active: 0, users_total: 0, users_missing: 0, ai_attended: 0, ai_visits: 0 }] }));
    montar();
    fireEvent.change(await screen.findByLabelText('Período'), { target: { value: 'hoje' } });
    await waitFor(() => expect(screen.getByText('Nova')).toBeInTheDocument());
    soltarVelha(resposta());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: 'Alfa' })).not.toBeInTheDocument();
  });

  it('estrutura só aparece quando vem; sem fatura avisa', async () => {
    apiGet.mockResolvedValue(resposta({ structure: { brl: 0, launched: [], missing: ['railway', 'vercel', 'evolution'] } }));
    montar('/admin/numeros?periodo=mes_atual');
    await waitFor(() => expect(screen.getByText('Faturas do mês ainda não lançadas')).toBeInTheDocument());
  });

  it('erro aparece como erro', async () => {
    apiGet.mockRejectedValueOnce(new Error('caiu'));
    montar();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('lista de clientes do seletor não some entre cargas', async () => {
    let soltar: (v: unknown) => void = () => {};
    apiGet
      .mockResolvedValueOnce(resposta())
      .mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    montar();
    const seletor = await screen.findByLabelText('Cliente');
    await waitFor(() => expect(within(seletor).getByRole('option', { name: 'Alfa' })).toBeInTheDocument());
    fireEvent.change(seletor, { target: { value: 'tenant_a' } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    const durante = screen.getByLabelText('Cliente') as HTMLSelectElement;
    expect(within(durante).getByRole('option', { name: 'Alfa' })).toBeInTheDocument();
    expect(durante.value).toBe('tenant_a');
    soltar(resposta());
  });

  it('ordenar por Custo da IA usa o custo mesmo de cliente ilegível', async () => {
    apiGet.mockResolvedValue(resposta({
      clients: [
        { schema: 'tenant_a', name: 'Alfa', readable: true, ai_cost_brl: 100, leads: 10 },
        { schema: 'tenant_b', name: 'Beta', readable: false, ai_cost_brl: 500 },
      ],
    }));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Custo da IA' }));
    const linhas = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(linhas).toEqual(['Beta', 'Alfa']);
  });
});
