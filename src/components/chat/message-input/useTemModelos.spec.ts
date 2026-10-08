import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getTemplates = vi.fn();
vi.mock('@/services/channels/messageTemplatesService', () => ({
  default: { getTemplates: (...a: unknown[]) => getTemplates(...a) },
}));

import { useTemModelos, _limparCacheDeModelos } from './useTemModelos';

describe('useTemModelos', () => {
  beforeEach(() => {
    getTemplates.mockReset();
    _limparCacheDeModelos();
  });

  it('número com modelo: mostra o botão', async () => {
    getTemplates.mockResolvedValue({ data: [{ id: 1 }] });
    const { result } = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(result.current).toBe(true));
    expect(getTemplates).toHaveBeenCalledWith('7', { per_page: 1 });
  });

  it('número sem modelo: esconde', async () => {
    getTemplates.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(getTemplates).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('consulta falhou: esconde e tenta de novo na próxima', async () => {
    getTemplates.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ data: [{ id: 1 }] });
    const { result, unmount } = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(getTemplates).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
    unmount();
    const segundo = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(segundo.result.current).toBe(true));
  });

  it('mesmo número em outra conversa não pergunta de novo', async () => {
    getTemplates.mockResolvedValue({ data: [{ id: 1 }] });
    const a = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(a.result.current).toBe(true));
    const b = renderHook(() => useTemModelos('7', true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(getTemplates).toHaveBeenCalledTimes(1);
  });

  it('recurso desligado no cliente: nem consulta', () => {
    const { result } = renderHook(() => useTemModelos('7', false));
    expect(result.current).toBe(false);
    expect(getTemplates).not.toHaveBeenCalled();
  });
});
