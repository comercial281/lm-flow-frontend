import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Recortes from './Recortes';
import Conferencia from './Conferencia';
import { fakeSummary } from './fakeSummary';

vi.mock('@/components/charts/BarChartCard', () => ({ default: ({ title }: { title: string }) => <div data-testid="grafico">{title}</div> }));

describe('Recortes', () => {
  it('mostra função, cliente e modelo com a parte de cada um', () => {
    render(<Recortes summary={fakeSummary({
      by_feature: [{ key: 'follow_up', label: 'Follow-up', brl: 300, usd: 60, calls: 500, share: 0.75 }],
      by_model: [{ key: 'claude-haiku-4-5', label: 'claude-haiku-4-5', brl: 300, usd: 60, calls: 500, share: 1 }],
      by_tenant: [{ schema: 'tenant_a', name: 'Alfa', brl: 300, usd: 60, calls: 500, share: 1 }],
      daily: [{ day: '2026-10-01', brl: 10 }],
      totals: { ...fakeSummary().totals, calls: 500 },
    })} />);
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Alfa')).toBeInTheDocument();
    expect(screen.getByText('Gasto de IA dia a dia')).toBeInTheDocument();
  });

  it('mês sem chamada: vazio que explica, sem quebrar', () => {
    render(<Recortes summary={fakeSummary({ daily: [{ day: '2026-10-01', brl: 0 }], totals: { ...fakeSummary().totals, calls: 0 } })} />);
    expect(screen.getAllByText('Nenhuma chamada de IA neste mês')).toHaveLength(4);
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
    expect(screen.getByText('Gasto de IA dia a dia')).toBeInTheDocument();
  });

  it('com cliente filtrado, o recorte por cliente some', () => {
    render(<Recortes summary={fakeSummary({ tenant: 'tenant_a' })} />);
    expect(screen.queryByText('Por cliente')).not.toBeInTheDocument();
  });
});

describe('Conferencia', () => {
  it('compara em US$ e convida a lançar quando falta a fatura', () => {
    const aoLancar = vi.fn();
    render(<Conferencia aoLancar={aoLancar} reconciliation={[
      { provider: 'anthropic', label: 'Anthropic', recorded_usd: 96, invoice_usd: 100, diff_pct: -4 },
      { provider: 'openai', label: 'OpenAI', recorded_usd: 2, invoice_usd: null, diff_pct: null },
    ]} />);
    expect(screen.getByText(/US\$\s96,00/)).toBeInTheDocument();
    expect(screen.getByText(/diferença -4%/)).toBeInTheDocument();
    expect(screen.getByText(/Fatura ainda não lançada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /lançar/i }));
    expect(aoLancar).toHaveBeenCalled();
  });
});
