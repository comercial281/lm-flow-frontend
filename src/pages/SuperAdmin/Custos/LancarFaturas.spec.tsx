import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: apiPut } }));

import LancarFaturas from './LancarFaturas';

const faturas = (railway: number | null) => ['anthropic', 'railway', 'vercel', 'evolution', 'openai', 'elevenlabs'].map((p) => ({
  provider: p, label: p[0].toUpperCase() + p.slice(1), amount_usd: p === 'railway' ? railway : null, note: null, entered_by_email: null, updated_at: null,
}));
const resposta = (month: string, railway: number | null) => ({ data: { success: true, data: { month, invoices: faturas(railway) } } });

describe('LancarFaturas', () => {
  beforeEach(() => { apiGet.mockReset(); apiPut.mockReset(); });

  it('carrega os valores do mês, salva em US$ e avisa quem abriu', async () => {
    apiGet.mockResolvedValue(resposta('2026-10', 80));
    apiPut.mockResolvedValue(resposta('2026-10', 80));
    const aoSalvar = vi.fn();
    render(<LancarFaturas month="2026-10" aberta aoFechar={vi.fn()} aoSalvar={aoSalvar} />);

    await waitFor(() => expect(screen.getByLabelText('Railway (US$)')).toHaveValue('80'));
    fireEvent.change(screen.getByLabelText('Vercel (US$)'), { target: { value: '43,72' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    const enviado = apiPut.mock.calls[0][1];
    expect(enviado.month).toBe('2026-10');
    expect(enviado.invoices.find((i: { provider: string }) => i.provider === 'vercel').amount_usd).toBe('43,72');
    expect(aoSalvar).toHaveBeenCalled();
  });

  it('mostra a mensagem do servidor quando o valor é recusado', async () => {
    apiGet.mockResolvedValue(resposta('2026-10', 80));
    apiPut.mockRejectedValue({ response: { data: { success: false, error: 'Railway: o valor não pode ser negativo' } } });
    render(<LancarFaturas month="2026-10" aberta aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Railway (US$)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(screen.getByText('Railway: o valor não pode ser negativo')).toBeInTheDocument());
  });

  it('reabrir com outro mês mostra os valores desse mês, não os do anterior', async () => {
    apiGet.mockResolvedValueOnce(resposta('2026-10', 80));
    const { rerender } = render(<LancarFaturas month="2026-10" aberta aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Railway (US$)')).toHaveValue('80'));

    rerender(<LancarFaturas month="2026-10" aberta={false} aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    let liberar: (v: unknown) => void = () => {};
    apiGet.mockReturnValueOnce(new Promise((r) => { liberar = r; }));
    rerender(<LancarFaturas month="2026-09" aberta aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    // Enquanto o mês novo carrega, nada do mês antigo aparece.
    expect(screen.queryByLabelText('Railway (US$)')).not.toBeInTheDocument();
    liberar(resposta('2026-09', 12.5));
    await waitFor(() => expect(screen.getByLabelText('Railway (US$)')).toHaveValue('12,5'));
  });

  it('descarta resposta atrasada de um mês que já não é o aberto', async () => {
    let liberarVelha: (v: unknown) => void = () => {};
    apiGet.mockReturnValueOnce(new Promise((r) => { liberarVelha = r; }));
    const { rerender } = render(<LancarFaturas month="2026-10" aberta aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    apiGet.mockResolvedValueOnce(resposta('2026-09', 12));
    rerender(<LancarFaturas month="2026-09" aberta aoFechar={vi.fn()} aoSalvar={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Railway (US$)')).toHaveValue('12'));
    liberarVelha(resposta('2026-10', 999));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByLabelText('Railway (US$)')).toHaveValue('12');
  });
});
