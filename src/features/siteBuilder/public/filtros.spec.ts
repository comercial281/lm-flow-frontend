import { describe, it, expect } from 'vitest';
import { opcoesSemRepetir, filterProperties, filtrosDaUrl, areaDoImovel, type PortalProperty, type PortalFilters } from './filtros';

describe('opcoesSemRepetir (cidades e bairros do site público)', () => {
  it('"Campinas" ×2 e "campinas " ×1 viram uma opção só, "Campinas"', () => {
    expect(opcoesSemRepetir(['Campinas', 'campinas ', 'Campinas'])).toEqual(['Campinas']);
  });
  it('mostra a grafia que mais aparece, mesmo que não seja a primeira', () => {
    expect(opcoesSemRepetir(['CAMBUÍ', 'Cambuí', 'cambui', 'Cambuí'])).toEqual(['Cambuí']);
  });
  it('no empate, a primeira que apareceu', () => {
    expect(opcoesSemRepetir(['sumaré', 'Sumaré'])).toEqual(['sumaré']);
  });
  it('ordem alfabética do português, sem vazio', () => {
    expect(opcoesSemRepetir(['Valinhos', null, 'Águas de Lindóia', '', '  ', undefined, 'Campinas', 'Barão Geraldo']))
      .toEqual(['Águas de Lindóia', 'Barão Geraldo', 'Campinas', 'Valinhos']);
  });
  it('a opção sai sem espaço nas pontas', () => {
    expect(opcoesSemRepetir([' Centro '])).toEqual(['Centro']);
  });
});

const imovel = (code: string, extra: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: 'apartment', ...extra,
});
const vazio: PortalFilters = { tab: 'sale', type: '', city: '', neighborhood: '', bedrooms: '', code: '' };

describe('filtros de condomínio, texto livre e área', () => {
  const semArea = imovel('S');
  const itens = [
    imovel('C1', { condominium_name: 'Collina Parque dos Príncipes', address: { city: 'Jundiaí', neighborhood: 'Centro' } }),
    imovel('B1', { address: { city: 'Barueri', neighborhood: 'Granja Viana' } }),
    imovel('A', { icon_summary: { useful_area_m2: 120, total_area_m2: 0 } }),
    imovel('T', { icon_summary: { useful_area_m2: 0, total_area_m2: 600 } }),
    semArea,
  ];
  it('condomínio casa sem acento e sem maiúscula', () => {
    const r = filterProperties(itens, { ...vazio, condominium: 'collina parque dos principes' });
    expect(r.map(p => p.code)).toEqual(['C1']);
  });
  it('texto livre procura em condomínio, bairro e cidade', () => {
    expect(filterProperties(itens, { ...vazio, place: 'granja' }).map(p => p.code)).toEqual(['B1']);
    expect(filterProperties(itens, { ...vazio, place: 'princ' }).map(p => p.code)).toEqual(['C1']);
    expect(filterProperties(itens, { ...vazio, place: 'JUNDIAI' }).map(p => p.code)).toEqual(['C1']);
  });
  it('área usa a útil, cai na total e tira quem não tem', () => {
    expect(filterProperties(itens, { ...vazio, area: '100' }).map(p => p.code)).toEqual(['A', 'T']);
    expect(areaDoImovel(semArea)).toBeNull();
  });
  it('lê os filtros novos da URL', () => {
    const f = filtrosDaUrl(new URLSearchParams('place=col&condominium=X&area=80'), 'sale');
    expect([f.place, f.condominium, f.area]).toEqual(['col', 'X', '80']);
  });
});
