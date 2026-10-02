import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const setConversations = vi.fn();
const resolvers: Array<(lista: string[]) => void> = [];
const applyFilters = vi.fn(
  (_f: unknown, onSuccess: (lista: string[], p: unknown) => void) =>
    new Promise<void>(resolve => {
      resolvers.push(lista => {
        onSuccess(lista, {});
        resolve();
      });
    }),
);

vi.mock('@/contexts/chat/ChatContext', () => ({
  useChatContext: () => ({
    conversations: { setConversations, loadConversations: vi.fn() },
    filters: { applyFilters, state: { activeFilters: [], searchTerm: '' } },
  }),
}));
vi.mock('@/utils/storage/filtersStorage', () => ({
  saveConversationFilters: vi.fn(),
  clearConversationFilters: vi.fn(),
}));

import { useFilterHandlers } from './useFilterHandlers';

describe('handleApplyFilters: pedido superado', () => {
  it('resposta lenta do primeiro pedido não sobrescreve o segundo', async () => {
    const { result } = renderHook(() => useFilterHandlers());
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.handleApplyFilters([]);
      p2 = result.current.handleApplyFilters([]);
    });
    await act(async () => {
      resolvers[1](['todas']);
      await p2;
      resolvers[0](['sem_resposta']);
      await p1;
    });
    expect(setConversations).toHaveBeenCalledTimes(1);
    expect(setConversations).toHaveBeenCalledWith(['todas'], {});
  });
});
