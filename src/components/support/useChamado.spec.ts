import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChamado } from './useChamado';

const adiavel = <T,>() => {
  let ok: (v: T) => void = () => {};
  const p = new Promise<T>(r => { ok = r; });
  return { p, ok };
};

describe('useChamado', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resposta antiga e lenta não sobrescreve a mais nova', async () => {
    const lenta = adiavel<string>();
    const carregar = vi.fn().mockReturnValueOnce(lenta.p).mockResolvedValueOnce('novo');
    const { result } = renderHook(() => useChamado(carregar));
    await act(async () => { await result.current.recarregar(); });
    expect(result.current.dado).toBe('novo');
    await act(async () => { lenta.ok('velho'); });
    expect(result.current.dado).toBe('novo');
  });

  it('não empilha: tick com requisição pendente é pulado', async () => {
    const lenta = adiavel<string>();
    const carregar = vi.fn(() => lenta.p);
    renderHook(() => useChamado(carregar, 1000));
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it('trocar o carregar zera o dado e carrega o novo', async () => {
    const a = vi.fn().mockResolvedValue('A');
    const b = adiavel<string>();
    const fb = vi.fn(() => b.p);
    const { result, rerender } = renderHook(({ f }) => useChamado(f), { initialProps: { f: a as () => Promise<string> } });
    await act(async () => {});
    expect(result.current.dado).toBe('A');
    rerender({ f: fb });
    expect(result.current.dado).toBeNull();
    expect(fb).toHaveBeenCalledTimes(1);
    await act(async () => { b.ok('B'); });
    expect(result.current.dado).toBe('B');
  });

  it('limpa o intervalo ao desmontar', async () => {
    const carregar = vi.fn().mockResolvedValue('x');
    const { unmount } = renderHook(() => useChamado(carregar, 1000));
    await act(async () => {});
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(carregar).toHaveBeenCalledTimes(1);
  });
});
