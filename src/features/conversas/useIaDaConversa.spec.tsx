import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useIaDaConversa } from './useIaDaConversa';
import { EVENTO_IA_RECARREGAR } from './atalhosDoLead';

const getSalesAgentStatus = vi.fn();
const toggleSalesAgent = vi.fn();
vi.mock('@/services/chat/chatService', () => ({
  chatService: { getSalesAgentStatus: (...a: unknown[]) => getSalesAgentStatus(...a), toggleSalesAgent: (...a: unknown[]) => toggleSalesAgent(...a) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const disparar = (conversationId: string) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_IA_RECARREGAR, { detail: { conversationId } }));
  });

describe('useIaDaConversa recarrega ao ouvir a atividade da IA', () => {
  afterEach(() => getSalesAgentStatus.mockReset());

  it('busca de novo pra mesma conversa e ignora outra', async () => {
    getSalesAgentStatus.mockResolvedValue({ state: { status: 'active', label: 'IA atendendo', agent_id: 'a' } });
    const { result } = renderHook(() => useIaDaConversa(5));
    await waitFor(() => expect(result.current.ligada).toBe(true));
    expect(getSalesAgentStatus).toHaveBeenCalledTimes(1);

    getSalesAgentStatus.mockResolvedValue({ state: { status: 'paused', label: 'IA desligada', agent_id: 'a' } });
    disparar('999');
    expect(getSalesAgentStatus).toHaveBeenCalledTimes(1);

    disparar('5');
    await waitFor(() => expect(result.current.ligada).toBe(false));
    expect(getSalesAgentStatus).toHaveBeenCalledTimes(2);
    expect(getSalesAgentStatus).toHaveBeenLastCalledWith('5');
  });
});

describe('useIaDaConversa: o pedido mais recente vence', () => {
  afterEach(() => { getSalesAgentStatus.mockReset(); toggleSalesAgent.mockReset(); });

  it('GET que começou antes da troca e volta depois não desfaz a troca', async () => {
    let soltar!: (v: unknown) => void;
    getSalesAgentStatus.mockReturnValueOnce(new Promise(r => { soltar = r; }));
    toggleSalesAgent.mockResolvedValue({ status: 'active', label: 'IA atendendo', agent_id: 'a' });
    const { result } = renderHook(() => useIaDaConversa(5));

    await act(async () => { await result.current.trocar(); });
    expect(result.current.ligada).toBe(true);

    await act(async () => { soltar({ state: { status: 'paused', label: 'IA desligada', agent_id: 'a' } }); });
    expect(result.current.ligada).toBe(true);
  });
});
