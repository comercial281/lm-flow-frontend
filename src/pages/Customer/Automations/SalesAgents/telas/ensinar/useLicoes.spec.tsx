import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const listLessons = vi.hoisted(() => vi.fn());
const createLesson = vi.hoisted(() => vi.fn());
const updateLesson = vi.hoisted(() => vi.fn());
const destroyLesson = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { listLessons, createLesson, updateLesson, destroyLesson },
  LIMITES_PADRAO: { per_kind: 12, conversations: 6 },
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useLicoes } from './useLicoes';

const L = (id: string, extra = {}) => ({ id, kind: 'rule', content: id, context: null, enabled: true, created_at: '', origin: 'manual', in_use: true, ...extra });

beforeEach(() => { vi.clearAllMocks(); });

describe('useLicoes', () => {
  it('carrega e relê depois de editar (o servidor recalcula o in_use)', async () => {
    listLessons.mockResolvedValueOnce({ licoes: [L('a')], limites: { per_kind: 12, conversations: 6 } })
      .mockResolvedValueOnce({ licoes: [L('a', { enabled: false, in_use: false })], limites: { per_kind: 12, conversations: 6 } });
    updateLesson.mockResolvedValue(L('a', { enabled: false }));
    const { result } = renderHook(() => useLicoes('ia-1'));
    await waitFor(() => expect(result.current.estado).toBe('pronto'));
    await act(async () => { await result.current.atualizar('a', { enabled: false }); });
    expect(updateLesson).toHaveBeenCalledWith('ia-1', 'a', { enabled: false });
    expect(result.current.licoes[0].in_use).toBe(false);
    expect(toast).toHaveBeenCalledWith('Salvo', expect.objectContaining({ action: expect.objectContaining({ label: 'Desfazer' }) }));
  });

  it('resposta atrasada de outra IA não entra (trocou de IA no meio)', async () => {
    let soltar!: (v: unknown) => void;
    listLessons.mockReturnValueOnce(new Promise((r) => { soltar = r; }))
      .mockResolvedValueOnce({ licoes: [L('da-b')], limites: { per_kind: 12, conversations: 6 } });
    const { result, rerender } = renderHook(({ id }) => useLicoes(id), { initialProps: { id: 'ia-a' } });
    rerender({ id: 'ia-b' });
    await waitFor(() => expect(result.current.licoes[0]?.id).toBe('da-b'));
    await act(async () => { soltar({ licoes: [L('da-a')], limites: { per_kind: 12, conversations: 6 } }); });
    expect(result.current.licoes.map((l) => l.id)).toEqual(['da-b']);
  });

  it('duas releituras fora de ordem: a antiga chegando por último não entra', async () => {
    listLessons.mockResolvedValueOnce({ licoes: [L('inicial')], limites: { per_kind: 12, conversations: 6 } });
    const { result } = renderHook(() => useLicoes('ia-1'));
    await waitFor(() => expect(result.current.estado).toBe('pronto'));
    let soltarAntiga!: (v: unknown) => void;
    let soltarNova!: (v: unknown) => void;
    listLessons.mockReturnValueOnce(new Promise((r) => { soltarAntiga = r; }))
      .mockReturnValueOnce(new Promise((r) => { soltarNova = r; }));
    let antiga!: Promise<void>;
    let nova!: Promise<void>;
    act(() => { antiga = result.current.carregar(); nova = result.current.carregar(); });
    await act(async () => { soltarNova({ licoes: [L('nova')], limites: { per_kind: 12, conversations: 6 } }); await nova; });
    expect(result.current.licoes.map((l) => l.id)).toEqual(['nova']);
    await act(async () => { soltarAntiga({ licoes: [L('antiga')], limites: { per_kind: 12, conversations: 3 } }); await antiga; });
    expect(result.current.licoes.map((l) => l.id)).toEqual(['nova']);
    expect(result.current.limites.conversations).toBe(6);
  });

  it('falha ao criar avisa e devolve false', async () => {
    listLessons.mockResolvedValue({ licoes: [], limites: { per_kind: 12, conversations: 6 } });
    createLesson.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useLicoes('ia-1'));
    await waitFor(() => expect(result.current.estado).toBe('pronto'));
    let ok = true;
    await act(async () => { ok = await result.current.criar('rule', 'nova'); });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
