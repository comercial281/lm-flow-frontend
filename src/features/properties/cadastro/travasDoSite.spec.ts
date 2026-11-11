import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { campoTravado, dicaSe, DICA_DO_CAMPO, DICA_DO_CONDOMINIO, CamposDoSiteContext, CamposDoCondominioContext, CamposTravadosContext, useDicaDoCampo, nomeNoFormulario } from './travasDoSite';

const LISTA_COMBINADA = ['title', 'description', 'sale_price', 'address_neighborhood', 'address_city', 'bedrooms', 'occupancy', 'accepts_financing'];

describe('campos travados pelo site (campo por campo)', () => {
  it('trava só o que está na lista; o resto da mesma seção fica livre', () => {
    expect(campoTravado('address_neighborhood', LISTA_COMBINADA)).toBe(true);
    expect(campoTravado('bedrooms', LISTA_COMBINADA)).toBe(true);
    expect(campoTravado('address_street', LISTA_COMBINADA)).toBe(false);
    expect(campoTravado('bathrooms', LISTA_COMBINADA)).toBe(false);
    expect(campoTravado('condo_fee', LISTA_COMBINADA)).toBe(false);
  });
  it('o CEP do formulário (address_zip) segue o nome do servidor (address_cep)', () => {
    expect(campoTravado('address_zip', ['address_cep'])).toBe(true);
    expect(campoTravado('address_zip', LISTA_COMBINADA)).toBe(false);
  });
  it('sem campos travados (fonte desligada), nada trava', () => {
    expect(campoTravado('title', [])).toBe(false);
  });
  it('dica só no campo travado', () => {
    expect(dicaSe(true)).toBe(DICA_DO_CAMPO);
    expect(dicaSe(false)).toBeUndefined();
  });
});

describe('dica por motivo da trava', () => {
  const wrap = (site: string[], condo: string[]) => ({ children }: { children: ReactNode }) =>
    createElement(CamposDoSiteContext.Provider, { value: site },
      createElement(CamposDoCondominioContext.Provider, { value: condo }, children));

  it('campo só no condomínio: dica do condomínio (CEP pelo nome do servidor)', () => {
    const { result } = renderHook(() => useDicaDoCampo('address_zip'), { wrapper: wrap([], ['address_cep']) });
    expect(result.current).toBe(DICA_DO_CONDOMINIO);
  });
  it('campo nas duas listas: o site vence', () => {
    const { result } = renderHook(() => useDicaDoCampo('address_city'), { wrapper: wrap(['address_city'], ['address_city']) });
    expect(result.current).toBe(DICA_DO_CAMPO);
  });
  it('sem contexto, sem dica; campo fora das listas, sem dica', () => {
    expect(renderHook(() => useDicaDoCampo('title')).result.current).toBeUndefined();
    const { result } = renderHook(() => useDicaDoCampo('title'), { wrapper: wrap(['bedrooms'], ['address_city']) });
    expect(result.current).toBeUndefined();
  });
  it('travado sem motivo informado (só a lista somada, como antes do condomínio): dica do site', () => {
    const soTravados = ({ children }: { children: ReactNode }) => createElement(CamposTravadosContext.Provider, { value: ['address_cep'] }, children);
    expect(renderHook(() => useDicaDoCampo('address_zip'), { wrapper: soTravados }).result.current).toBe(DICA_DO_CAMPO);
    expect(renderHook(() => useDicaDoCampo('title'), { wrapper: soTravados }).result.current).toBeUndefined();
  });
  it('nomeNoFormulario inverte o mapeamento do CEP', () => {
    expect(nomeNoFormulario('address_cep')).toBe('address_zip');
    expect(nomeNoFormulario('address_city')).toBe('address_city');
  });
});
