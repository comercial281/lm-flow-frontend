import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// O robô do topo da conversa: ligar num número dividido pede o agente (C81).
const s = vi.hoisted(() => ({ listForInbox: vi.fn(), toggle: vi.fn(), getConversation: vi.fn(), status: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { listForInbox: s.listForInbox } }));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { toggleSalesAgent: s.toggle, getSalesAgentStatus: s.status, getConversation: s.getConversation },
}));

import { useIaDaConversa } from './useIaDaConversa';

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.status.mockResolvedValue({ state: { status: 'paused', label: 'IA desligada', agent_id: 'a' } });
  s.getConversation.mockResolvedValue({ data: { inbox_id: 'i1', additional_attributes: {} } });
  s.toggle.mockResolvedValue({ status: 'active', label: 'IA ligada', agent_id: 'b' });
});

describe('useIaDaConversa: ligar', () => {
  it('número dividido abre a escolha e só liga quando confirmar com o id', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }, { id: 'b', name: 'Agente B' }]);
    const { result } = renderHook(() => useIaDaConversa(5));
    await waitFor(() => expect(result.current.estado).not.toBeNull());
    await act(async () => { await result.current.trocar(); });
    expect(result.current.janela.open).toBe(true);
    expect(s.toggle).not.toHaveBeenCalled();
    await act(async () => { result.current.janela.onConfirmar('b'); });
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('5', true, 'b'));
    await waitFor(() => expect(result.current.ligada).toBe(true));
  });

  it('um agente só liga direto', async () => {
    s.listForInbox.mockResolvedValue([{ id: 'a', name: 'Agente A' }]);
    const { result } = renderHook(() => useIaDaConversa(5));
    await waitFor(() => expect(result.current.estado).not.toBeNull());
    await act(async () => { await result.current.trocar(); });
    expect(s.toggle).toHaveBeenCalledWith('5', true);
    expect(result.current.janela.open).toBe(false);
  });
});
