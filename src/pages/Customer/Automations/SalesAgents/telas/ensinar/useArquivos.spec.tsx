import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const listDocuments = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { listDocuments, destroyDocument: vi.fn(), reprocessDocument: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { useArquivos } from './useArquivos';

const D = (id: string) => ({ id, title: id, status: 'ready' });

beforeEach(() => { vi.clearAllMocks(); });

describe('useArquivos', () => {
  it('duas releituras fora de ordem: a antiga chegando por último não entra', async () => {
    listDocuments.mockResolvedValueOnce([D('inicial')]);
    const { result } = renderHook(() => useArquivos('ia-1', vi.fn()));
    await waitFor(() => expect(result.current.estado).toBe('pronto'));
    let soltarAntiga!: (v: unknown) => void;
    let soltarNova!: (v: unknown) => void;
    listDocuments.mockReturnValueOnce(new Promise((r) => { soltarAntiga = r; }))
      .mockReturnValueOnce(new Promise((r) => { soltarNova = r; }));
    let antiga!: Promise<void>;
    let nova!: Promise<void>;
    act(() => { antiga = result.current.carregar(); nova = result.current.carregar(); });
    await act(async () => { soltarNova([D('nova')]); await nova; });
    expect(result.current.docs.map((d) => d.id)).toEqual(['nova']);
    await act(async () => { soltarAntiga([D('antiga')]); await antiga; });
    expect(result.current.docs.map((d) => d.id)).toEqual(['nova']);
  });

  it('a antiga falhando depois da nova não vira erro', async () => {
    listDocuments.mockResolvedValueOnce([D('inicial')]);
    const { result } = renderHook(() => useArquivos('ia-1', vi.fn()));
    await waitFor(() => expect(result.current.estado).toBe('pronto'));
    let falharAntiga!: (e: unknown) => void;
    listDocuments.mockReturnValueOnce(new Promise((_, rej) => { falharAntiga = rej; }))
      .mockResolvedValueOnce([D('nova')]);
    let antiga!: Promise<void>;
    let nova!: Promise<void>;
    act(() => { antiga = result.current.carregar(); nova = result.current.carregar(); });
    await act(async () => { await nova; });
    await act(async () => { falharAntiga(new Error('x')); await antiga; });
    expect(result.current.estado).toBe('pronto');
    expect(result.current.docs.map((d) => d.id)).toEqual(['nova']);
  });
});
