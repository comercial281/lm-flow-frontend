import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FocusEvent, PointerEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { usePreviaComAtraso } from './usePreviaComAtraso';

// O jsdom não tem PointerEvent: o evento do React só precisa do tipo e do alvo.
const ponteiro = (el: HTMLElement, pointerType = 'mouse') =>
  ({ pointerType, currentTarget: el }) as unknown as PointerEvent<HTMLElement>;
const foco = (el: HTMLElement) => ({ currentTarget: el }) as unknown as FocusEvent<HTMLElement>;

let alvo: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  alvo = document.createElement('button');
  document.body.appendChild(alvo);
});

afterEach(() => {
  alvo.remove();
  vi.useRealTimers();
});

const passar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('usePreviaComAtraso', () => {
  it('abre depois de 450 ms parado', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    expect(result.current.armando).toBe(true);
    passar(449);
    expect(result.current.aberta).toBe(false);
    passar(1);
    expect(result.current.aberta).toBe(true);
    expect(result.current.armando).toBe(false);
    expect(result.current.ancora).toBe(alvo);
  });

  it('não abre se o mouse sai antes do atraso', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(300);
    act(() => result.current.alvoProps.onPointerLeave(ponteiro(alvo)));
    expect(result.current.armando).toBe(false);
    passar(1000);
    expect(result.current.aberta).toBe(false);
  });

  it('toque não abre a prévia', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo, 'touch')));
    expect(result.current.armando).toBe(false);
    passar(1000);
    expect(result.current.aberta).toBe(false);
  });

  it('caneta também não abre', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo, 'pen')));
    passar(1000);
    expect(result.current.aberta).toBe(false);
  });

  it('Esc fecha', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(450);
    expect(result.current.aberta).toBe(true);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.aberta).toBe(false);
  });

  it('Esc durante a espera cancela', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(200);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    passar(1000);
    expect(result.current.aberta).toBe(false);
    expect(result.current.armando).toBe(false);
  });

  it('rolar fecha (inclusive rolagem de dentro da página)', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(450);
    const caixa = document.createElement('div');
    document.body.appendChild(caixa);
    act(() => { caixa.dispatchEvent(new Event('scroll')); }); // scroll não sobe: só a captura pega
    expect(result.current.aberta).toBe(false);
    caixa.remove();
  });

  it('dá 140 ms de folga pra entrar no cartão', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(450);
    act(() => result.current.alvoProps.onPointerLeave(ponteiro(alvo)));
    passar(100);
    act(() => result.current.conteudoProps.onPointerEnter(ponteiro(alvo)));
    passar(500);
    expect(result.current.aberta).toBe(true);
    act(() => result.current.conteudoProps.onPointerLeave(ponteiro(alvo)));
    passar(139);
    expect(result.current.aberta).toBe(true);
    passar(1);
    expect(result.current.aberta).toBe(false);
  });

  it('sem entrar no cartão, fecha depois da folga', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(450);
    act(() => result.current.alvoProps.onPointerLeave(ponteiro(alvo)));
    passar(140);
    expect(result.current.aberta).toBe(false);
  });

  it('foco pelo teclado arma com o mesmo atraso e sair do foco fecha', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    alvo.focus();
    act(() => result.current.alvoProps.onFocus(foco(alvo)));
    expect(result.current.armando).toBe(true);
    passar(449);
    expect(result.current.aberta).toBe(false);
    passar(1);
    expect(result.current.aberta).toBe(true);
    act(() => result.current.alvoProps.onBlur(foco(alvo)));
    passar(140);
    expect(result.current.aberta).toBe(false);
  });

  it('apertar a peça fecha e o foco do clique não reabre', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    passar(450);
    act(() => result.current.alvoProps.onPointerDown(ponteiro(alvo)));
    expect(result.current.aberta).toBe(false);
    alvo.focus();
    act(() => result.current.alvoProps.onFocus(foco(alvo)));
    passar(1000);
    expect(result.current.aberta).toBe(false);
  });

  it('fechar() cancela tudo', () => {
    const { result } = renderHook(() => usePreviaComAtraso({}));
    act(() => result.current.alvoProps.onPointerEnter(ponteiro(alvo)));
    act(() => result.current.fechar());
    passar(1000);
    expect(result.current.aberta).toBe(false);
    expect(result.current.armando).toBe(false);
  });
});
