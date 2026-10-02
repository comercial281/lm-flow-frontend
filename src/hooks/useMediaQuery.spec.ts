import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

// O painel do lead abre sozinho em tela de 1280px ou mais: a largura tem de
// estar certa já no primeiro desenho e acompanhar o redimensionamento.

const original = window.matchMedia;

function simularTela(casaInicial: boolean) {
  let casa = casaInicial;
  const ouvintes = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return casa; },
    media: query,
    addEventListener: (_: string, fn: () => void) => ouvintes.add(fn),
    removeEventListener: (_: string, fn: () => void) => ouvintes.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return {
    mudar(novo: boolean) {
      casa = novo;
      ouvintes.forEach(fn => fn());
    },
    ouvintes,
  };
}

describe('useMediaQuery', () => {
  afterEach(() => {
    window.matchMedia = original;
  });

  it('nasce com o valor da tela e acompanha a mudança', () => {
    const tela = simularTela(true);
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(true);

    act(() => tela.mudar(false));
    expect(result.current).toBe(false);

    unmount();
    expect(tela.ouvintes.size).toBe(0);
  });

  it('sem matchMedia (servidor, teste antigo): false', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(false);
  });
});
