import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, put: vi.fn() } }));

import Margem from './Margem';

const linha = (over = {}) => ({
  schema: 'tenant_a', name: 'Imobiliária Alfa', kind: 'performance', revenue_source: 'package', package_name: 'Completo',
  revenue_brl: 1000, ai_brl: 50, structure_brl: 405, cost_brl: 455, margin_brl: 545, margin_pct: 54.5, share: 0.675,
  readable: true, ...over,
});
const relatorio = (over = {}) => ({
  month: '2026-10', kind: 'todos', rate: { value: 5.46 }, structure_brl: 600, partial: false, missing_invoices: [],
  totals: { revenue_brl: 1000, ai_brl: 50, structure_brl: 405, cost_brl: 455, margin_brl: 545, margin_pct: 54.5, clients: 1 },
  without_revenue: 1,
  clients: [linha(), linha({ schema: 'tenant_g', name: 'Imobiliária Gama', kind: null, revenue_source: null, package_name: null,
    revenue_brl: null, ai_brl: 0, structure_brl: 60, cost_brl: 60, margin_brl: null, margin_pct: null, share: 0.1 })],
  unreadable: [], ...over,
});
const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
// Como em Custos: o filtro mora no pai, para sobreviver à troca de mês/cliente.
function Pai({ aoLancar, mes = '2026-10' }: { aoLancar: () => void; mes?: string }) {
  const [kind, setKind] = useState('todos');
  return <Margem month={mes} kind={kind} aoMudarKind={setKind} recarga={0} aoLancar={aoLancar} />;
}
const montar = (aoLancar = vi.fn()) => render(<MemoryRouter><Pai aoLancar={aoLancar} /></MemoryRouter>);

describe('Custos → Margem', () => {
  beforeEach(() => apiGet.mockReset());

  it('margem por cliente e da carteira; sem receita aparece fora da conta; diz que o rateio é aproximado', async () => {
    apiGet.mockImplementation(() => ok(relatorio()));
    montar();
    expect(await screen.findByText('Imobiliária Alfa')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/super/costs/margins', { params: { month: '2026-10' } });
    expect(screen.getByText('Cota do plano Completo')).toBeInTheDocument();
    expect(screen.getAllByText(/545,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('1 cliente sem receita (fora da conta).')).toBeInTheDocument();
    expect(screen.getAllByText('Sem receita').length).toBeGreaterThan(0);
    expect(screen.getByText(/rateio aproximado, pela carteira e pelo disco de hoje/i)).toBeInTheDocument();
  });

  it('mês parcial avisa as faturas que faltam e leva a lançar', async () => {
    apiGet.mockImplementation(() => ok(relatorio({ partial: true, missing_invoices: ['Railway', 'Vercel'] })));
    const aoLancar = vi.fn();
    const user = userEvent.setup();
    montar(aoLancar);
    expect(await screen.findByText('Margem parcial: faltam as faturas de Railway, Vercel.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lançar faturas' }));
    expect(aoLancar).toHaveBeenCalled();
  });

  it('filtro Avulso pede kind=avulso e, sem ninguém, mostra vazio', async () => {
    apiGet.mockImplementation((_url: string, cfg?: { params?: Record<string, string> }) =>
      ok(cfg?.params?.kind === 'avulso' ? relatorio({ kind: 'avulso', clients: [], without_revenue: 0 }) : relatorio()));
    const user = userEvent.setup();
    montar();
    await screen.findByText('Imobiliária Alfa');
    await user.click(screen.getByRole('tab', { name: 'Avulso' }));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/super/costs/margins', { params: { month: '2026-10', kind: 'avulso' } }));
    expect(await screen.findByText('Nenhum cliente Avulso')).toBeInTheDocument();
  });

  it('nenhum cliente com receita: cartões em "—" e aviso, nunca R$ 0,00', async () => {
    apiGet.mockImplementation(() => ok(relatorio({
      totals: { revenue_brl: 0, ai_brl: 0, structure_brl: 0, cost_brl: 0, margin_brl: 0, margin_pct: null, clients: 0 },
      without_revenue: 2,
      clients: [linha({ revenue_brl: null, margin_brl: null, margin_pct: null, revenue_source: null })],
    })));
    montar();
    expect(await screen.findByText('Nenhum cliente com receita neste filtro. Marque a receita na aba Contrato de cada cliente.')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/R\$\s0,00/)).not.toBeInTheDocument();
  });

  it('erro aparece como erro com tentar de novo, nunca como vazio', async () => {
    apiGet.mockRejectedValueOnce(new Error('boom')).mockImplementation(() => ok(relatorio()));
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Imobiliária Alfa')).toBeInTheDocument();
  });

  it('margem negativa aparece com o sinal e na cor de alerta; cliente não lido não inventa número', async () => {
    apiGet.mockImplementation(() => ok(relatorio({
      clients: [linha({ margin_brl: -120, margin_pct: -12 }), linha({ schema: 'tenant_l', name: 'Imobiliária Lenta', readable: false, structure_brl: null, cost_brl: null, margin_brl: null, margin_pct: null, share: null })],
      unreadable: [{ name: 'Imobiliária Lenta', message: 'não deu tempo de ler' }],
    })));
    montar();
    const negativa = await screen.findByText(/-R\$\s?120,00|−R\$\s?120,00|R\$\s?-120,00/);
    expect(negativa).toHaveClass('text-destructive');
    expect(screen.getByText('não lido')).toBeInTheDocument();
    expect(screen.getByText(/Não deu tempo de ler Imobiliária Lenta/)).toBeInTheDocument();
    expect(screen.getByText(/foi dividida entre os outros nesta leitura/)).toBeInTheDocument();
    expect(screen.queryByText(/ficou de fora/)).not.toBeInTheDocument();
  });
});
