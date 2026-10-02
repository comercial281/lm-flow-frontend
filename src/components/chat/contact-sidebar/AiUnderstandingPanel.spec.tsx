import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiUnderstandingPanel from './AiUnderstandingPanel';
import type { Conversation } from '@/types/chat/api';
import type { SalesAgentLeadReport } from '@/types/analytics/pipelines';

// "O que a IA entendeu" só existe se a IA atendeu. Em número sem IA o backend
// grava um turno "Nenhuma IA vinculada a este canal" a cada mensagem do lead, e
// isso não é histórico: a seção não pode aparecer só com essas linhas.

const getSalesAgentStatus = vi.fn();
vi.mock('@/services/chat/chatService', () => ({
  chatService: { getSalesAgentStatus: (...a: unknown[]) => getSalesAgentStatus(...a) },
}));

const conversa = { id: 'c1', additional_attributes: {} } as unknown as Conversation;

const semIa = (status: 'none' | 'idle'): SalesAgentLeadReport => ({
  state: { status, label: '', agent_id: null },
  why: 'Nenhuma IA vinculada a este canal.',
  next_step: null,
  runs: [1, 2, 3].map(i => ({
    status: 'skipped',
    delivered: null,
    reason: 'agent_missing',
    reason_label: 'Nenhuma IA vinculada a este canal',
    error_message: null,
    created_at: `2026-10-02T16:1${i}:00Z`,
  })),
});

afterEach(() => {
  cleanup();
  getSalesAgentStatus.mockReset();
});

describe('AiUnderstandingPanel', () => {
  it('não aparece quando o canal não tem IA e os turnos são só "sem IA"', async () => {
    getSalesAgentStatus.mockResolvedValue(semIa('none'));
    const { container } = render(<AiUnderstandingPanel conversation={conversa} embutido />);
    await waitFor(() => expect(getSalesAgentStatus).toHaveBeenCalled());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(container).toBeEmptyDOMElement();
  });

  it('com IA no canal, mostra o histórico sem os turnos "sem IA"', async () => {
    const report = semIa('idle');
    report.why = 'O gatilho ainda não bateu.';
    report.runs.push({
      status: 'replied',
      delivered: true,
      reason: null,
      reason_label: null,
      error_message: null,
      created_at: '2026-10-02T17:00:00Z',
    });
    getSalesAgentStatus.mockResolvedValue(report);
    render(<AiUnderstandingPanel conversation={conversa} embutido />);

    const botao = await screen.findByRole('button', { name: /Histórico e próximos passos/ });
    expect(botao.textContent).toContain('(1)');
    fireEvent.click(botao);
    expect(screen.getByText(/Respondeu o lead/)).toBeTruthy();
    expect(screen.queryByText(/· Nenhuma IA vinculada/)).toBeNull();
  });
});
