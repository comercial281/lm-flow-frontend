import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlideshow } from './useSlideshow';

function reduzir(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
function aba(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useSlideshow', () => {
  beforeEach(() => { vi.useFakeTimers(); reduzir(false); aba(false); });
  afterEach(() => { vi.useRealTimers(); aba(false); });

  it('avança a cada 6 s e volta ao começo', () => {
    const { result } = renderHook(() => useSlideshow(3));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(12000); });
    expect(result.current).toBe(0);
  });
  it('uma foto só não troca', () => {
    const { result } = renderHook(() => useSlideshow(1));
    act(() => { vi.advanceTimersByTime(30000); });
    expect(result.current).toBe(0);
  });
  it('reduzir animações fica na primeira', () => {
    reduzir(true);
    const { result } = renderHook(() => useSlideshow(3));
    act(() => { vi.advanceTimersByTime(12000); });
    expect(result.current).toBe(0);
  });
  it('aba escondida pausa e volta a andar ao reaparecer', () => {
    const { result } = renderHook(() => useSlideshow(3));
    act(() => { aba(true); });
    act(() => { vi.advanceTimersByTime(18000); });
    expect(result.current).toBe(0);
    act(() => { aba(false); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current).toBe(1);
  });
  it('volta ao começo se o total muda', () => {
    const { result, rerender } = renderHook(({ n }) => useSlideshow(n), { initialProps: { n: 3 } });
    act(() => { vi.advanceTimersByTime(12000); });
    expect(result.current).toBe(2);
    rerender({ n: 2 });
    expect(result.current).toBe(0);
  });
});
