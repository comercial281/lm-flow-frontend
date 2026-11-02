import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// "Religar IA neste lead" no menu da conversa: lista os agentes do número, abre a janela e liga com o id.
const s = vi.hoisted(() => ({ listForInbox: vi.fn(), toggle: vi.fn() }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/chat/useConversations', () => ({ useConversations: () => ({}) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@evoapi/design-system/badge', () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('@evoapi/design-system/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { listForInbox: s.listForInbox } }));
vi.mock('@/services/chat/chatService', () => ({ chatService: { toggleSalesAgent: s.toggle, getSalesAgentStatus: vi.fn() } }));

import ConversationActionsDropdown from './ConversationActionsDropdown';

const conversa = {
  id: 'c1', inbox_id: 'i1', status: 'open', priority: null, unread_count: 0, custom_attributes: {},
  additional_attributes: { sales_agent_paused: true },
} as never;

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.toggle.mockResolvedValue({ status: 'active', label: 'IA ligada' });
});

describe('ConversationActionsDropdown: religar a IA', () => {
  it('número dividido: lista → janela → toggleSalesAgent(id, true, "b")', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }, { id: 'b', name: 'Agente B' }]);
    render(<ConversationActionsDropdown conversation={conversa} />);
    await userEvent.click(screen.getByText('Religar IA neste lead'));
    expect(await screen.findByText('Escolha qual agente atende')).toBeInTheDocument();
    expect(s.listForInbox).toHaveBeenCalledWith('i1');
    await userEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Religar IA' }));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('c1', true, 'b'));
  });

  it('um agente só liga direto', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }]);
    render(<ConversationActionsDropdown conversation={conversa} />);
    await userEvent.click(screen.getByText('Religar IA neste lead'));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('c1', true));
  });
});
