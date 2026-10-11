import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CONSULTA_CELULAR, ehCelular, useCelular } from './useCelular';
import { simularCelular } from '@/test/telaDeCelular';

// O detector único de celular da casa (Raio-X do celular, 10/10/2026).

let tela: ReturnType<typeof simularCelular> | null = null;
afterEach(() => {
  tela?.restaurar();
  tela = null;
});

describe('detector de celular', () => {
  it('o corte é abaixo de 768px', () => {
    expect(CONSULTA_CELULAR).toBe('(max-width: 767px)');
  });

  it('sem matchMedia (teste, servidor) é computador', () => {
    const original = window.matchMedia;
    // @ts-expect-error simulando ambiente sem matchMedia
    window.matchMedia = undefined;
    try {
      expect(ehCelular()).toBe(false);
      expect(renderHook(() => useCelular()).result.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('ehCelular lê a tela na hora; useCelular acompanha o redimensionamento', () => {
    tela = simularCelular();
    expect(ehCelular()).toBe(true);
    const { result } = renderHook(() => useCelular());
    expect(result.current).toBe(true);
    act(() => tela!.mudar(false));
    expect(result.current).toBe(false);
    expect(ehCelular()).toBe(false);
  });
});
