import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { avisarSuporte, useSinalSuporte } from './aoVivo';

function visibilidade(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
}

describe('useSinalSuporte', () => {
  afterEach(() => visibilidade('visible'));

  it('entrega o sinal na hora com a aba visível', () => {
    const aoMudar = vi.fn();
    renderHook(() => useSinalSuporte(aoMudar));
    act(() => avisarSuporte('t1'));
    expect(aoMudar).toHaveBeenCalledWith('t1');
  });

  // Abrir = ler: entregar com a aba escondida marcava como lida uma mensagem que ninguém viu.
  it('com a aba escondida guarda o sinal e entrega quando a pessoa volta', () => {
    const aoMudar = vi.fn();
    renderHook(() => useSinalSuporte(aoMudar));
    visibilidade('hidden');
    act(() => {
      avisarSuporte('t1');
      avisarSuporte('t1');
    });
    expect(aoMudar).not.toHaveBeenCalled();
    visibilidade('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith('t1');
  });

  it('para de ouvir ao desmontar', () => {
    const aoMudar = vi.fn();
    const { unmount } = renderHook(() => useSinalSuporte(aoMudar));
    unmount();
    act(() => avisarSuporte('t1'));
    expect(aoMudar).not.toHaveBeenCalled();
  });
});
