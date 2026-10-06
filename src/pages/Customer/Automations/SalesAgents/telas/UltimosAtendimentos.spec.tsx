import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const runs = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { runs } }));
import UltimosAtendimentos from './UltimosAtendimentos';

const RUN = {
  id: 'r1', kind: 'live', status: 'failed', delivered: false, skip_reason: null, reason_label: 'Falhou ao responder',
  model: null, input_tokens: 0, output_tokens: 0, cost_usd: 0.0123, latency_ms: null,
  error_class: 'Faraday::TimeoutError', error_message: 'execution expired', conversation_id: null, created_at: '2026-10-06T14:32:00-03:00',
};

// Chaves: o beforeEach que RETORNA o mock é lido pelo vitest como função de limpeza
// e chama o runs() de novo depois do teste (a rejeição do 3º teste vira erro solto).
beforeEach(() => { runs.mockReset(); });

describe('UltimosAtendimentos', () => {
  it('cliente: situação, tipo e hora; sem custo e sem o erro técnico', async () => {
    runs.mockResolvedValue({ runs: [RUN], totals: {} });
    render(<UltimosAtendimentos agentId="ia-1" completo={false} />);
    expect(await screen.findByRole('heading', { name: 'Últimos atendimentos' })).toBeInTheDocument();
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(screen.getByText(/Conversa/)).toBeInTheDocument();
    expect(screen.queryByText(/Faraday/)).toBeNull();
    expect(screen.queryByText(/US\$/)).toBeNull();
  });

  it('equipe: o erro técnico e o custo', async () => {
    runs.mockResolvedValue({ runs: [RUN], totals: {} });
    render(<UltimosAtendimentos agentId="ia-1" completo />);
    expect(await screen.findByText(/Faraday::TimeoutError: execution expired/)).toBeInTheDocument();
  });

  it('leitura que falha (cargo sem a permissão) não grita: o bloco não aparece', async () => {
    runs.mockRejectedValue(new Error('403'));
    const { container } = render(<UltimosAtendimentos agentId="ia-1" completo={false} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
