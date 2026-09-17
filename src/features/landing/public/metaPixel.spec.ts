import { describe, expect, it, vi } from 'vitest';
import { PIXEL_LOAD_CEILING_MS, installPixel, loadPixelScript } from './metaPixel';

/** Uma janela de mentira: documento carregando, sem fbq, com relógio controlado. */
function fakeWindow(readyState = 'loading') {
  const listeners: Record<string, Array<() => void>> = {};
  const head = { appendChild: vi.fn() };
  const timers: Array<{ fn: () => void; ms: number }> = [];
  return {
    document: { readyState, head, createElement: (tag: string) => ({ tag, async: false, src: '' }) },
    addEventListener: (ev: string, fn: () => void) => { (listeners[ev] ??= []).push(fn); },
    setTimeout: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; },
    fire: (ev: string) => listeners[ev]?.forEach((fn) => fn()),
    timers,
    head,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('installPixel', () => {
  it('enfileira init e PageView NA HORA, e só baixa o script quando a página carrega', () => {
    const w = fakeWindow();
    installPixel('123', { win: w });

    expect(w.fbq.queue).toEqual([['init', '123'], ['track', 'PageView']]);
    expect(w.head.appendChild).not.toHaveBeenCalled();

    w.fire('load');
    expect(w.head.appendChild).toHaveBeenCalledTimes(1);
    expect(w.head.appendChild.mock.calls[0][0].src).toBe('https://connect.facebook.net/en_US/fbevents.js');
  });

  it('pageView: false não dispara o PageView', () => {
    const w = fakeWindow();
    installPixel('123', { win: w, pageView: false });
    expect(w.fbq.queue).toEqual([['init', '123']]);
  });

  it('página que nunca termina de carregar: o teto baixa o script mesmo assim, uma vez só', () => {
    const w = fakeWindow();
    installPixel('123', { win: w });
    const ceiling = w.timers.find((t: { ms: number }) => t.ms === PIXEL_LOAD_CEILING_MS);
    ceiling.fn();
    w.fire('load');
    expect(w.head.appendChild).toHaveBeenCalledTimes(1);
  });

  it('página já carregada: baixa na hora', () => {
    const w = fakeWindow('complete');
    loadPixelScript(w);
    expect(w.head.appendChild).toHaveBeenCalledTimes(1);
  });

  it('segunda chamada (página de resultado depois da landing) não baixa o script duas vezes', () => {
    const w = fakeWindow('complete');
    loadPixelScript(w);
    loadPixelScript(w);
    expect(w.head.appendChild).toHaveBeenCalledTimes(1);
  });
});
