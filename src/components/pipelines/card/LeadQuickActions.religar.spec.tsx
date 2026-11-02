import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PipelineItem } from '@/types/analytics';

// Ligar a IA no cartão do funil num número dividido pede o agente (C81).
const s = vi.hoisted(() => ({ listForInbox: vi.fn(), toggle: vi.fn(), getConversation: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/conversations/conversationService', () => ({ conversationAPI: { addLabels: vi.fn() } }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { listForInbox: s.listForInbox } }));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { toggleSalesAgent: s.toggle, getSalesAgentStatus: vi.fn(), getConversation: s.getConversation },
}));

import LeadQuickActions from './LeadQuickActions';

const item = {
  id: 'i1', pipeline_id: 'p1',
  conversation: { id: 'conv1', contact: { id: 'c1', name: 'Maria Teste' } },
  sales_agent: { status: 'paused', label: 'IA desligada' },
} as unknown as PipelineItem;

const abrir = () => render(
  <LeadQuickActions item={item} nomeExibido="Maria Teste" abrindoConversa={false} onAbrirConversa={vi.fn()} onVisitaCriada={vi.fn()} />,
);

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.getConversation.mockResolvedValue({ data: { inbox_id: 'i1', additional_attributes: {} } });
  s.toggle.mockResolvedValue({ status: 'active', label: 'IA ligada' });
});

describe('LeadQuickActions: ligar a IA', () => {
  it('número dividido pede a escolha e liga com o agente escolhido', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }, { id: 'b', name: 'Agente B' }]);
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'IA desligada' }));
    expect(await screen.findByText('Escolha qual agente atende')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Religar IA' }));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('conv1', true, 'b'));
  });

  it('um agente só no número liga direto', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }]);
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'IA desligada' }));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('conv1', true));
    expect(screen.queryByText('Escolha qual agente atende')).toBeNull();
  });
});
