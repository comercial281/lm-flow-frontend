import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn(async () => ({ data: [] })),
    getPipelineStages: vi.fn(async () => ({ data: [] })),
  },
}));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    list: vi.fn(async () => [{ id: 'fu-1', name: 'Follow-up padrão', is_enabled: true, archived_at: null }]),
  },
}));

import { FollowupActionPicker, FollowupHoursRow } from './FollowupSection';

const AVISO = 'Escolha como o follow-up continua: a IA não escreve mais o follow-up.';

beforeEach(() => vi.clearAllMocks());

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

  it('escolher uma opção grava a escolha', async () => {
    const onSave = vi.fn();
    render(<FollowupActionPicker agent={agenteDeTeste({ followup_action: 'ai' })} onSave={onSave} />);
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
