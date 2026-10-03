import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: vi.fn() } }));

import ListaDeChamadas from './ListaDeChamadas';

const linha = {
  id: 'c1', created_at: '2026-10-10T12:00:00Z', tenant_schema: 'tenant_a', tenant_name: 'Alfa',
  feature: 'follow_up', feature_label: 'Follow-up', provider: 'anthropic', model: 'claude-haiku-4-5',
  cost_usd: 0.01, cost_brl: 0.05, latency_ms: 900, status: 'ok', error_message: null,
  input_tokens: 2000, output_tokens: 80, cache_read_tokens: 0, cache_write_tokens: 0,
  audio_seconds: null, characters: null, units_estimated: false, priced: true,
};

const pagina = (items: unknown[], page = 1, total = items.length) =>
  ({ data: { success: true, data: { items, meta: { total, page, per_page: 50 } } } });

describe('ListaDeChamadas', () => {
  // chaves: o retorno do mockReset viraria teardown e chamaria o mock de novo
  beforeEach(() => { apiGet.mockReset(); });

  it('lista, pagina e abre o detalhe com o aviso de conteúdo apagado', async () => {
    apiGet.mockImplementation((url: string, cfg?: { params?: Record<string, unknown> }) => {
      if (url === '/super/costs/calls') {
        const page = (cfg?.params?.page as number) ?? 1;
        return Promise.resolve({ data: { success: true, data: { items: [{ ...linha, id: `c${page}` }], meta: { total: 60, page, per_page: 50 } } } });
      }
      return Promise.resolve({ data: { success: true, data: { ...linha, trigger_type: 'conversation', trigger_id: '9', user_id: null, usd_brl_rate: 5, payload_status: 'apagado', payload_ttl_days: 7, request: null, response: null } } });
    });

    render(<ListaDeChamadas month="2026-10" tenant={null} funcoes={[]} />);
    await waitFor(() => expect(screen.getByText('Follow-up')).toBeInTheDocument());
    expect(screen.getByText('Alfa')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /próxima/i }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, page: 2 } }));

    fireEvent.click(screen.getByText('Follow-up'));
    await waitFor(() => expect(screen.getByText('Conteúdo apagado depois de 7 dias')).toBeInTheDocument());
  });

  it('"só erros" refaz a busca com status=error', async () => {
    apiGet.mockResolvedValue(pagina([]));
    render(<ListaDeChamadas month="2026-10" tenant="tenant_a" funcoes={[]} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('Só erros'));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, tenant: 'tenant_a', status: 'error' } }));
  });

  it('erro na lista vira erro com tentar de novo', async () => {
    apiGet.mockRejectedValue(new Error('x'));
    render(<ListaDeChamadas month="2026-10" tenant={null} funcoes={[]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument());
  });

  it('filtro na página 2 volta pra página 1 sem buscar a página 2 do filtro novo', async () => {
    apiGet.mockImplementation((_u: string, cfg?: { params?: Record<string, unknown> }) =>
      Promise.resolve(pagina([{ ...linha, id: 'x' }], (cfg?.params?.page as number) ?? 1, 120)));
    render(<ListaDeChamadas month="2026-10" tenant={null} funcoes={[]} />);
    await waitFor(() => expect(screen.getByText('Follow-up')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByLabelText('Só erros'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(3));
    await act(async () => { await Promise.resolve(); });
    expect(apiGet).toHaveBeenCalledTimes(3);
    expect(apiGet).toHaveBeenLastCalledWith('/super/costs/calls', { params: { month: '2026-10', per_page: 20, status: 'error' } });
  });

  it('resposta lenta de busca antiga não sobrescreve a nova', async () => {
    let soltaVelha: (v: unknown) => void = () => {};
    apiGet.mockImplementationOnce(() => new Promise((r) => { soltaVelha = r; }));
    apiGet.mockImplementationOnce(() => Promise.resolve(pagina([{ ...linha, id: 'novo', feature_label: 'Resposta nova' }])));
    const { rerender } = render(<ListaDeChamadas month="2026-10" tenant={null} funcoes={[]} />);
    rerender(<ListaDeChamadas month="2026-10" tenant="tenant_a" funcoes={[]} />);
    await waitFor(() => expect(screen.getByText('Resposta nova')).toBeInTheDocument());
    await act(async () => { soltaVelha(pagina([{ ...linha, id: 'velho', feature_label: 'Resposta velha' }])); });
    expect(screen.queryByText('Resposta velha')).not.toBeInTheDocument();
    expect(screen.getByText('Resposta nova')).toBeInTheDocument();
  });

  it('trocar filtro esconde linhas e contagem antigas até a resposta nova', async () => {
    let solta: (v: unknown) => void = () => {};
    apiGet.mockImplementationOnce(() => Promise.resolve(pagina([linha], 1, 1)));
    apiGet.mockImplementationOnce(() => new Promise((r) => { solta = r; }));
    render(<ListaDeChamadas month="2026-10" tenant={null} funcoes={[]} />);
    await waitFor(() => expect(screen.getByText('Follow-up')).toBeInTheDocument());
    expect(screen.getByText('Chamadas (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Só erros'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Follow-up')).not.toBeInTheDocument();
    expect(screen.queryByText('Ok')).not.toBeInTheDocument();
    expect(screen.queryByText('Chamadas (1)')).not.toBeInTheDocument();
    await act(async () => { solta(pagina([{ ...linha, id: 'e1', feature_label: 'Só falha', status: 'error' }], 1, 1)); });
    expect(screen.getByText('Só falha')).toBeInTheDocument();
  });
});
