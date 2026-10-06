import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn(async () => ({ data: [] })),
    getPipelineStages: vi.fn(async () => ({ data: [] })),
  },
}));
const list = vi.fn();
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: (...a: unknown[]) => list(...a) },
}));

import { FollowupActionPicker, FollowupHoursRow } from './FollowupSection';

const FLUXOS = [
  { id: 'fu-pos-visita', name: 'Pós-visita', is_enabled: true, archived_at: null, template_key: 'follow_up_padrao', followup_padrao: false, created_at: '2026-06-01T00:00:00Z' },
  { id: 'fu-padrao', name: 'Meu follow-up', is_enabled: true, archived_at: null, template_key: 'follow_up_padrao', followup_padrao: true, created_at: '2026-10-06T00:00:00Z' },
];

const AVISO = 'Escolha como o follow-up continua: a IA não escreve mais o follow-up.';

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue(FLUXOS);
});

// 06/10/2026: "A IA escreve a mensagem" saiu. Sobram duas saídas, e a IA que ficou
// na antiga não tem nenhuma marcada até alguém escolher.
describe('Quando o lead sumir', () => {
  it('só duas opções, sem "A IA escreve a mensagem"', () => {
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'sequence' })} onSave={vi.fn()} />);
    const opcoes = screen.getAllByRole('radio');
    expect(opcoes).toHaveLength(2);
    expect(screen.getByLabelText(/Mover o card para uma coluna/)).toBeTruthy();
    expect(screen.getByLabelText(/Entregar pro follow-up/)).toBeTruthy();
    expect(screen.queryByText(/A IA escreve a mensagem/)).toBeNull();
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it('IA ainda na opção antiga: nenhuma marcada e o aviso', () => {
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'ai' })} onSave={vi.fn()} />);
    for (const r of screen.getAllByRole('radio')) expect((r as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(AVISO)).toBeTruthy();
  });

  it('IA sem valor nenhum: nenhuma marcada e pede a escolha', () => {
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: undefined as never })} onSave={vi.fn()} />);
    for (const r of screen.getAllByRole('radio')) expect((r as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Escolha o que ela faz quando o lead some.')).toBeTruthy();
  });

  it('mover o card grava só a escolha', async () => {
    const onSave = vi.fn();
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'ai' })} onSave={onSave} />);
    await waitFor(() => expect(list).toHaveBeenCalledWith({ kind: 'followup' }));
    await userEvent.click(screen.getByLabelText(/Mover o card para uma coluna/));
    expect(onSave).toHaveBeenCalledWith({ followup_action: 'pipeline' });
  });

  // 06/10/2026: "Entregar pro follow-up" sem nenhum escolhido já vem com o Follow-up padrão.
  it('entregar pro follow-up sem nenhum escolhido traz o Follow-up padrão (pela marca, mesmo renomeado)', async () => {
    const onSave = vi.fn();
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'ai', followup_flow_id: null })} onSave={onSave} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.click(screen.getByLabelText(/Entregar pro follow-up/));
    expect(onSave).toHaveBeenCalledWith({ followup_action: 'sequence', followup_flow_id: 'fu-padrao' });
  });

  it('com um follow-up já escolhido, não troca', async () => {
    const onSave = vi.fn();
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'pipeline', followup_flow_id: 'fu-pos-visita' })} onSave={onSave} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.click(screen.getByLabelText(/Entregar pro follow-up/));
    expect(onSave).toHaveBeenCalledWith({ followup_action: 'sequence' });
  });

  it('sem nenhum follow-up ligado no cliente, fica vazio', async () => {
    list.mockResolvedValue([{ ...FLUXOS[0], is_enabled: false }]);
    const onSave = vi.fn();
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'ai', followup_flow_id: null })} onSave={onSave} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.click(screen.getByLabelText(/Entregar pro follow-up/));
    expect(onSave).toHaveBeenCalledWith({ followup_action: 'sequence' });
  });
});

describe('Quando o follow-up pode sair', () => {
  it('fala sempre em entregar o lead, qualquer que seja a opção', () => {
    for (const acao of ['ai', 'pipeline', 'sequence'] as const) {
      const { unmount } = render(<FollowupHoursRow agent={agenteDeTeste({ followup_action: acao })} onSave={vi.fn()} />);
      expect(screen.getByText('quando a IA entrega o lead')).toBeTruthy();
      unmount();
    }
  });
});
