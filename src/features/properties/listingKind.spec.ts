import { describe, expect, it } from 'vitest';
import {
  FILTROS_VAZIOS, abaPadrao, anosDaPrevisao, filtrosAtivos, juntarMesAno, lerAba, linhaDasTipologias, linkNaLista,
  mesAno, paraCampoMes, paramsDosFiltros, separarMesAno, rotuloDaFase, rotuloDaSituacao, seloDaFase, textoDasUnidades, tipoDoImovel, tirarFiltro,
} from './listingKind';

describe('tipo do imóvel', () => {
  it('servidor antigo (sem listing_kind) cai em Revenda', () => {
    expect(tipoDoImovel({})).toBe('resale');
    expect(tipoDoImovel({ listing_kind: null })).toBe('resale');
    expect(tipoDoImovel({ listing_kind: 'development' })).toBe('development');
  });

  it('aba do endereço e aba padrão', () => {
    expect(lerAba(new URLSearchParams('aba=empreendimentos'))).toBe('development');
    expect(lerAba(new URLSearchParams('aba=revenda'))).toBe('resale');
    expect(lerAba(new URLSearchParams('aba=xyz'))).toBeNull();
    expect(abaPadrao({ development: 10, resale: 958 })).toBe('resale');
    expect(abaPadrao({ development: 25, resale: 0 })).toBe('development');
    expect(abaPadrao({ development: 0, resale: 0 })).toBe('development');
  });

  it('link da busca global abre a aba do imóvel, com a busca', () => {
    expect(linkNaLista({ listing_kind: 'development', code: 'EM0001' })).toBe('/properties?aba=empreendimentos&q=EM0001');
    expect(linkNaLista({ code: 'AP 10' })).toBe('/properties?aba=revenda&q=AP%2010');
    expect(linkNaLista({ listing_kind: 'resale', code: '', title: 'Casa' })).toBe('/properties?aba=revenda&q=Casa');
  });
});

describe('fase e entrega', () => {
  it('rótulos novos', () => {
    expect(rotuloDaFase('launch')).toBe('Na planta');
    expect(rotuloDaFase('in_construction')).toBe('Em obra');
    expect(rotuloDaFase('pre_launch')).toBe('Pré-lançamento');
    expect(rotuloDaFase('ready')).toBe('Pronto para morar');
  });

  it('mês/ano', () => {
    expect(mesAno('2027-12-01')).toBe('dez/2027');
    expect(mesAno(null)).toBeNull();
    expect(paraCampoMes('2027-12-01')).toBe('2027-12');
    expect(paraCampoMes(null)).toBe('');
  });

  it('selo: pronto não mostra entrega; sem entrega, só a fase', () => {
    expect(seloDaFase('in_construction', '2027-12-01')).toBe('Em obra · entrega dez/2027');
    expect(seloDaFase('ready', '2027-12-01')).toBe('Pronto para morar');
    expect(seloDaFase('launch', null)).toBe('Na planta');
  });
});

describe('situação por tipo', () => {
  it('revenda diz Disponível; empreendimento diz À venda e Esgotado', () => {
    expect(rotuloDaSituacao('resale', 'active')).toBe('Disponível');
    expect(rotuloDaSituacao('development', 'active')).toBe('À venda');
    expect(rotuloDaSituacao('development', 'sold')).toBe('Esgotado');
    expect(rotuloDaSituacao('resale', 'sold')).toBe('Vendido');
  });
});

describe('tipologias e unidades', () => {
  it('linha das tipologias', () => {
    expect(linhaDasTipologias([
      { bedrooms: 2, useful_area_m2: 58 }, { bedrooms: 3, useful_area_m2: 74 }, { bedrooms: 3, useful_area_m2: 98 },
    ] as never)).toBe('3 tipologias · 2 a 3 dorms · 58 a 98 m²');
    expect(linhaDasTipologias([{ bedrooms: 2, useful_area_m2: 64 }] as never)).toBe('1 tipologia · 2 dorms · 64 m²');
    expect(linhaDasTipologias([])).toBeNull();
  });

  it('área das tipologias no formato brasileiro', () => {
    expect(linhaDasTipologias([{ bedrooms: 2, useful_area_m2: 58.5 }] as never)).toBe('1 tipologia · 2 dorms · 58,5 m²');
    expect(linhaDasTipologias([
      { bedrooms: 2, useful_area_m2: 58.5 }, { bedrooms: 3, useful_area_m2: 98.75 },
    ] as never)).toBe('2 tipologias · 2 a 3 dorms · 58,5 a 98,75 m²');
  });

  it('unidades', () => {
    expect(textoDasUnidades(14, 'active')).toBe('14 unidades disponíveis');
    expect(textoDasUnidades(1, 'active')).toBe('1 unidade disponível');
    expect(textoDasUnidades(null, 'active')).toBeNull();
    expect(textoDasUnidades(0, 'sold')).toBe('Esgotado');
  });
});

describe('filtros', () => {
  it('cada aba só manda os próprios filtros', () => {
    const rev = { ...FILTROS_VAZIOS.resale, finalidade: 'locacao', quartos: [2, 4] };
    // Locação inclui Venda e locação e Temporada; Venda inclui Venda e locação (Ruling R11).
    expect(paramsDosFiltros('resale', rev)).toEqual({ 'transaction_type[]': ['rent', 'sale_rent', 'season'], 'bedrooms[]': ['2', '4'] });
    expect(paramsDosFiltros('resale', { ...FILTROS_VAZIOS.resale, finalidade: 'venda' })).toEqual({ 'transaction_type[]': ['sale', 'sale_rent'] });

    const emp = { ...FILTROS_VAZIOS.development, fases: ['launch'], entregaAte: '2028', precoMin: '300000' };
    expect(paramsDosFiltros('development', emp)).toEqual({
      'stage[]': ['launch'], delivery_until: '2028', min_price: '300000',
    });
  });

  it('chips e tirar um filtro', () => {
    const emp = { ...FILTROS_VAZIOS.development, fases: ['launch', 'in_construction'], bairro: 'Taquaral' };
    const chips = filtrosAtivos('development', emp);
    expect(chips.map(c => c.rotulo)).toEqual(['Fase: Na planta, Em obra', 'Bairro: Taquaral']);
    expect(tirarFiltro('development', emp, 'fases')).toEqual({ ...emp, fases: [] });
  });

  it('Só com book: manda has_book, vira etiqueta e sai pela etiqueta', () => {
    const emp = { ...FILTROS_VAZIOS.development, comBook: true };
    expect(paramsDosFiltros('development', emp)).toEqual({ has_book: '1' });
    expect(filtrosAtivos('development', emp).map(c => c.rotulo)).toEqual(['Com book']);
    expect(tirarFiltro('development', emp, 'comBook')).toEqual(FILTROS_VAZIOS.development);
    expect(paramsDosFiltros('development', FILTROS_VAZIOS.development)).toEqual({});
  });
});

describe('previsão de entrega em mês e ano', () => {
  it('junta e separa', () => {
    expect(juntarMesAno('2027', '12')).toBe('2027-12');
    expect(juntarMesAno('', '12')).toBe('');
    expect(juntarMesAno('2027', '')).toBe('');
    expect(separarMesAno('2027-12')).toEqual({ ano: '2027', mes: '12' });
    expect(separarMesAno('2027-12-01')).toEqual({ ano: '2027', mes: '12' });
    expect(separarMesAno('')).toEqual({ ano: '', mes: '' });
  });

  it('anos: do ano passado a 8 à frente, mais o já salvo', () => {
    expect(anosDaPrevisao(2026)).toEqual(['2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034']);
    expect(anosDaPrevisao(2026, '2020')[0]).toBe('2020');
    expect(anosDaPrevisao(2026, '2027')).toHaveLength(10);
  });
});
