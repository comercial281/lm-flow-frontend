import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readKeyboardInset, useKeyboardInsetVar } from './useKeyboardInset';

type Cb = () => void;

/**
 * jsdom não tem window.visualViewport — é justamente a API que o hook mede, e
 * a ausência dela também é o teste da guarda de capacidade.
 */
function stubViewport(init: { height: number; offsetTop?: number; scale?: number }) {
  const listeners: Record<string, Set<Cb>> = { resize: new Set(), scroll: new Set() };
  const vv = {
    height: init.height,
    offsetTop: init.offsetTop ?? 0,
    scale: init.scale ?? 1,
    addEventListener: (type: string, cb: Cb) => listeners[type]?.add(cb),
    removeEventListener: (type: string, cb: Cb) => listeners[type]?.delete(cb),
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, writable: true, value: vv });
  return { vv, emit: (type: 'resize' | 'scroll') => listeners[type].forEach(cb => cb()) };
}

const inset = () => document.documentElement.style.getPropertyValue('--keyboard-inset');

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
  // rAF síncrono: o teste não espera quadro nenhum.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'visualViewport');
  document.documentElement.removeAttribute('style');
});

describe('readKeyboardInset', () => {
  it('devolve 0 sem visualViewport (jsdom, desktop antigo)', () => {
    expect(readKeyboardInset()).toBe(0);
  });

  it('ignora diferença pequena (barra de endereço, barra de rolagem)', () => {
    stubViewport({ height: 740 }); // 60px
    expect(readKeyboardInset()).toBe(0);
  });

  it('mede o teclado', () => {
    stubViewport({ height: 500 }); // 300px
    expect(readKeyboardInset()).toBe(300);
  });

  it('desconta o offsetTop do iOS', () => {
    stubViewport({ height: 500, offsetTop: 60 });
    expect(readKeyboardInset()).toBe(240);
  });

  it('ignora pinça (zoom encolhe a área visível sem teclado)', () => {
    stubViewport({ height: 400, scale: 2 });
    expect(readKeyboardInset()).toBe(0);
  });

  it('limita a 60% da janela', () => {
    stubViewport({ height: 100 }); // 700px -> teto de 480
    expect(readKeyboardInset()).toBe(480);
  });
});

describe('useKeyboardInsetVar', () => {
  it('escreve a variável quando o teclado abre e limpa ao desmontar', () => {
    const vp = stubViewport({ height: 800 });
    const { unmount } = renderHook(() => useKeyboardInsetVar());
    expect(inset()).toBe('0px');

    vp.vv.height = 500;
    vp.emit('resize');
    expect(inset()).toBe('300px');

    unmount();
    expect(inset()).toBe('');
  });

  it('reage a scroll do visualViewport (iOS mexe só no offsetTop)', () => {
    const vp = stubViewport({ height: 500 });
    renderHook(() => useKeyboardInsetVar());
    expect(inset()).toBe('300px');

    vp.vv.offsetTop = 60;
    vp.emit('scroll');
    expect(inset()).toBe('240px');
  });

  it('volta a zero quando o teclado fecha', () => {
    const vp = stubViewport({ height: 500 });
    renderHook(() => useKeyboardInsetVar());
    expect(inset()).toBe('300px');

    vp.vv.height = 800;
    vp.emit('resize');
    expect(inset()).toBe('0px');
  });
});
