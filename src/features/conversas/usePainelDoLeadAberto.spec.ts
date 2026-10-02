import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePainelDoLeadAberto } from './usePainelDoLeadAberto';

// O painel não abria na PRIMEIRA conversa aberta a partir de /conversations: a
// seleção muda antes do endereço (navigate em transição), o efeito de abrir
// abria e o de fechar, ainda vendo o endereço vazio, fechava em seguida.
// Este spec reproduz a ordem real: seleção primeiro, endereço depois.

type Props = { url: string | undefined; sel: string | null; larga: boolean };

const montar = (inicial: Props) =>
  renderHook(({ url, sel, larga }: Props) => usePainelDoLeadAberto(url, sel, larga), {
    initialProps: inicial,
  });

describe('usePainelDoLeadAberto', () => {
  it('tela larga: abrir a 1ª conversa de /conversations deixa o painel aberto', () => {
    const { result, rerender } = montar({ url: undefined, sel: null, larga: true });
    expect(result.current[0]).toBe(false);

    // A seleção chega antes do endereço.
    rerender({ url: undefined, sel: 'c1', larga: true });
    expect(result.current[0]).toBe(true);

    // Depois o endereço alcança.
    rerender({ url: 'c1', sel: 'c1', larga: true });
    expect(result.current[0]).toBe(true);
  });

  it('o X fecha até a próxima troca; trocar reabre em tela larga', () => {
    const { result, rerender } = montar({ url: 'c1', sel: 'c1', larga: true });
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));
    rerender({ url: 'c1', sel: 'c1', larga: true });
    expect(result.current[0]).toBe(false);

    rerender({ url: 'c1', sel: 'c2', larga: true });
    expect(result.current[0]).toBe(true);
  });

  it('voltar para /conversations fecha', () => {
    const { result, rerender } = montar({ url: 'c1', sel: 'c1', larga: true });
    rerender({ url: undefined, sel: null, larga: true });
    expect(result.current[0]).toBe(false);
  });

  it('abaixo de 1280px: abre só no clique e a troca não mexe', () => {
    const { result, rerender } = montar({ url: undefined, sel: null, larga: false });
    rerender({ url: undefined, sel: 'c1', larga: false });
    rerender({ url: 'c1', sel: 'c1', larga: false });
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    rerender({ url: 'c2', sel: 'c2', larga: false });
    expect(result.current[0]).toBe(true);
  });
});
