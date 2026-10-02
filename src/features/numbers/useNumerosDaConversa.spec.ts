import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mayRead = vi.fn();
const fetchInboxes = vi.fn();
let estado: { inboxes: unknown[]; lastFetchTimestamps: { inboxes: number }; fetchInboxes: typeof fetchInboxes };

vi.mock('@/store/appDataStore', () => ({
  mayRead: (p: string) => mayRead(p),
  useAppDataStore: (sel: (s: typeof estado) => unknown) => sel(estado),
}));

import { useNumerosDaConversa } from './useNumerosDaConversa';

const inbox = { id: 7, name: 'Número A', channel_type: 'Channel::Whatsapp', connection_status: 'connected', owner_user_id: 'u1' };

describe('useNumerosDaConversa', () => {
  beforeEach(() => {
    mayRead.mockReset();
    fetchInboxes.mockReset().mockResolvedValue(undefined);
    estado = { inboxes: [], lastFetchTimestamps: { inboxes: 0 }, fetchInboxes };
  });

  it('sem permissão: null e não busca', async () => {
    mayRead.mockResolvedValue(false);
    const { result } = renderHook(() => useNumerosDaConversa());
    await waitFor(() => expect(mayRead).toHaveBeenCalledWith('inboxes.read'));
    expect(fetchInboxes).not.toHaveBeenCalled();
    expect(result.current).toEqual({ inboxes: null, numeros: null });
  });

  it('com permissão: busca uma vez e deriva os números', async () => {
    mayRead.mockResolvedValue(true);
    estado = { inboxes: [inbox], lastFetchTimestamps: { inboxes: 123 }, fetchInboxes };
    const { result } = renderHook(() => useNumerosDaConversa());
    await waitFor(() => expect(result.current.numeros).not.toBeNull());
    expect(fetchInboxes).toHaveBeenCalledTimes(1);
    expect(result.current.inboxes).toEqual([inbox]);
    expect(result.current.numeros).toEqual([
      { id: '7', name: 'Número A', connection_status: 'connected', owner_user_id: 'u1' },
    ]);
  });

  it('com permissão mas ainda sem carga: null, nunca lista vazia', async () => {
    mayRead.mockResolvedValue(true);
    const { result } = renderHook(() => useNumerosDaConversa());
    await waitFor(() => expect(fetchInboxes).toHaveBeenCalled());
    expect(result.current).toEqual({ inboxes: null, numeros: null });
  });

  it('carregou e está vazio: lista vazia (diferente de null)', async () => {
    mayRead.mockResolvedValue(true);
    estado = { inboxes: [], lastFetchTimestamps: { inboxes: 5 }, fetchInboxes };
    const { result } = renderHook(() => useNumerosDaConversa());
    await waitFor(() => expect(result.current.numeros).toEqual([]));
  });
});
