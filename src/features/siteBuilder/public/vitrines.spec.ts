import { describe, it, expect } from 'vitest';
import type { PortalProperty, SiteInfo } from '@/pages/Public/portalShared';
import { filterProperties } from './filtros';
import { resolverHome } from './homeConfig';
import { atalhosDoSite } from './maisBuscados';
import { abasVisiveis, itensDaVitrine, vitrinesVisiveis, buscaDaRegra, chamadasVisiveis } from './vitrines';

const p = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: 'apartment', listing_kind: 'resale',
  sale_price_from: 500000, rent_price_from: null, address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const emp = (code: string, o: Partial<PortalProperty> = {}) => p(code, { listing_kind: 'development', stage: 'in_construction', ...o });
const f = (tab: 'sale'|'rent'|'launch', o = {}) => ({ tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '', ...o });

describe('abas e filtros', () => {
  const items = [p('R1'), p('L1', { transaction_type: 'rent', rent_price_from: 3000, sale_price_from: null }), emp('E1')];
  it('Lançamentos = só empreendimento; Comprar inclui empreendimento; Alugar só revenda de locação', () => {
    expect(filterProperties(items, f('launch')).map(x => x.code)).toEqual(['E1']);
    expect(filterProperties(items, f('sale')).map(x => x.code)).toEqual(['R1', 'E1']);
    expect(filterProperties(items, f('rent')).map(x => x.code)).toEqual(['L1']);
  });
  it('destaque sozinho não vira lançamento', () => {
    expect(filterProperties([p('D1', { featured: true })], f('launch'))).toEqual([]);
  });
  it('faixa de preço usa o preço da aba; sem preço sai quando há faixa', () => {
    const semPreco = emp('E2', { sale_price_from: null });
    expect(filterProperties([...items, semPreco], f('sale', { price_max: '600000' })).map(x => x.code)).toEqual(['R1', 'E1']);
    expect(filterProperties([...items, semPreco], f('sale')).map(x => x.code)).toContain('E2');
    expect(filterProperties(items, f('rent', { price_max: '2000' }))).toEqual([]);
  });
  it('suítes, vagas e fase', () => {
    const a = p('S', { icon_summary: { suites: 2, parking: 1 } });
    expect(filterProperties([a], f('sale', { suites: '2', parking: '2' }))).toEqual([]);
    expect(filterProperties([a, emp('E3', { stage: 'ready' })], f('sale', { stage: 'ready' })).map(x => x.code)).toEqual(['E3']);
  });
  it('tipo pega os sinônimos do mesmo nome (cobertura = penthouse, terreno = lot…)', () => {
    const lista = [p('C1', { property_type: 'cobertura' }), p('C2', { property_type: 'penthouse' }),
      p('T1', { property_type: 'lot' }), p('T2', { property_type: 'terreno' }), p('A1')];
    expect(filterProperties(lista, f('sale', { type: 'cobertura' })).map(x => x.code)).toEqual(['C1', 'C2']);
    expect(filterProperties(lista, f('sale', { type: 'penthouse' })).map(x => x.code)).toEqual(['C1', 'C2']);
    expect(filterProperties(lista, f('sale', { type: 'lot' })).map(x => x.code)).toEqual(['T1', 'T2']);
    expect(filterProperties(lista, f('sale', { type: 'apartment' })).map(x => x.code)).toEqual(['A1']);
  });
  it('aba desligada ou vazia some; tudo vazio → nenhuma', () => {
    const home = resolverHome({ search: { tabs: { rent: false } } });
    expect(abasVisiveis(home, items)).toEqual(['sale', 'launch']);
    expect(abasVisiveis(resolverHome(null), [p('R1')])).toEqual(['sale']);
    expect(abasVisiveis(resolverHome(null), [])).toEqual([]);
  });
});

describe('vitrines', () => {
  const items = [p('A', { featured: true }), p('B'), emp('C'), p('D', { address: { city: 'Campinas', neighborhood: 'Cambuí' }, sale_price_from: 450000 })];
  it('fábrica: lançamentos e destaques', () => {
    const h = resolverHome(null);
    expect(itensDaVitrine(items, h.showcases[0]).map(x => x.code)).toEqual(['C']);
    expect(itensDaVitrine(items, h.showcases[1]).map(x => x.code)).toEqual(['A']);
  });
  it('regra do cliente e limite', () => {
    const v = { id: 'x', kind: 'custom' as const, enabled: true, title: 'Cambuí',
      rules: { transaction: 'sale' as const, listing_kind: null, property_types: ['apartment'], cities: [], neighborhoods: ['Cambuí'],
               price_min: null, price_max: 500000, stages: [], featured_only: false } };
    expect(itensDaVitrine(items, v).map(x => x.code)).toEqual(['D']);
    expect(itensDaVitrine(Array.from({ length: 9 }, (_, i) => p(`Z${i}`, { featured: true })), resolverHome(null).showcases[1]).length).toBe(6);
  });
  it('regra de tipo casa pelo nome: cobertura = penthouse', () => {
    const v = { id: 'c', kind: 'custom' as const, enabled: true, title: 'Coberturas',
      rules: { transaction: null, listing_kind: null, property_types: ['cobertura'], cities: [], neighborhoods: [],
               price_min: null, price_max: null, stages: [], featured_only: false } };
    const lista = [p('C1', { property_type: 'cobertura' }), p('C2', { property_type: 'penthouse' }), p('A1')];
    expect(itensDaVitrine(lista, v).map(x => x.code)).toEqual(['C1', 'C2']);
  });
  it('vitrine com preço mínimo e o "Ver todos" concordam num imóvel exatamente no mínimo', () => {
    const rules = { transaction: 'sale' as const, listing_kind: null, property_types: [], cities: [], neighborhoods: [],
      price_min: 500000, price_max: null, stages: [], featured_only: false };
    const v = { id: 'm', kind: 'custom' as const, enabled: true, title: 'A partir de 500 mil', rules };
    const lista = [p('NA_DIVISA', { sale_price_from: 500000 }), p('ABAIXO', { sale_price_from: 499999 })];
    const q = new URLSearchParams(buscaDaRegra(rules));
    const busca = filterProperties(lista, { ...f('sale'), price_min: q.get('price_min') ?? '' }).map(x => x.code);
    expect(itensDaVitrine(lista, v).map(x => x.code)).toEqual(['NA_DIVISA']);
    expect(busca).toEqual(['NA_DIVISA']);
  });
  it('vitrine desligada ou vazia some', () => {
    const h = resolverHome({ showcases: [{ id: 'featured', kind: 'featured', enabled: false }] });
    expect(vitrinesVisiveis(h, [p('B')]).map(v => v.vitrine.id)).toEqual([]);
    expect(vitrinesVisiveis(resolverHome(null), items).map(v => v.vitrine.id)).toEqual(['launches', 'featured']);
  });
  it('"Ver todos" vira busca', () => {
    expect(buscaDaRegra({ transaction: 'rent', listing_kind: null, property_types: ['house'], cities: ['Campinas'], neighborhoods: [],
      price_min: null, price_max: 4000, stages: [], featured_only: false })).toBe('tab=rent&type=house&city=Campinas&price_max=4000');
    expect(buscaDaRegra({ transaction: null, listing_kind: 'development', property_types: [], cities: [], neighborhoods: [],
      price_min: null, price_max: null, stages: ['ready'], featured_only: false })).toBe('tab=launch&stage=ready');
  });
});

describe('home torta do servidor não derruba o site', () => {
  it('itens nulos e vitrine sem regras completas', () => {
    const h = resolverHome({ showcases: [null, { id: 'x', kind: 'custom', title: 'T' }, { id: 'y', kind: 'custom', title: 'Y', rules: { cities: 'x' } }],
      callouts: { custom: [null, 3] }, most_searched: { mode: 'manual', items: [null] } });
    expect(() => vitrinesVisiveis(h, [p('A')])).not.toThrow();
    expect(() => chamadasVisiveis({ home: h } as SiteInfo, 'imob')).not.toThrow();
    expect(() => atalhosDoSite(h, [p('A')])).not.toThrow();
    expect(vitrinesVisiveis(h, [p('A')]).map(v => v.vitrine.id)).toEqual(['x', 'y']);
  });
});

describe('chamadas', () => {
  const base = (o: Partial<SiteInfo> = {}): SiteInfo => ({ financiamento: { enabled: true }, anuncie: { enabled: true },
    sections: { lead_capture: true }, contact: { whatsapp: '5511999990000' }, menu: [{ title: 'Sobre', slug: 'sobre' }], ...o } as SiteInfo);
  it('padrão com texto de fábrica; destino desligado some', () => {
    const c = chamadasVisiveis(base({ anuncie: { enabled: false } } as Partial<SiteInfo>), 'imob');
    expect(c.map(x => x.key)).toEqual(['financing', 'wanted']);
    expect(c[0]).toMatchObject({ title: 'Financiamento', button: 'Faça uma simulação', to: '/portal/imob/financiamento' });
  });
  it('texto editado vence o de fábrica; padrão desligado some', () => {
    const home = { callouts: { defaults: { financing: { enabled: true, title: 'Crédito', text: null, button: null },
      wanted: { enabled: false } } } };
    const c = chamadasVisiveis(base({ home } as Partial<SiteInfo>), 'imob');
    expect(c.find(x => x.key === 'financing')?.title).toBe('Crédito');
    expect(c.find(x => x.key === 'wanted')).toBeUndefined();
  });
  it('url que não é http(s) não vira cartão', () => {
    const home = { callouts: { custom: [{ title: 'X', text: null, button: null, dest_type: 'url', dest_value: 'javascript:alert(1)' }] } };
    expect(chamadasVisiveis(base({ home } as Partial<SiteInfo>), 'imob').find(x => x.title === 'X')).toBeUndefined();
  });
  it('livres: whatsapp sem número some, página inexistente some, link externo abre fora', () => {
    const home = { callouts: { custom: [
      { title: 'Zap', text: null, button: null, dest_type: 'whatsapp', dest_value: null },
      { title: 'Pg', text: null, button: null, dest_type: 'page', dest_value: 'apagada' },
      { title: 'Site', text: null, button: 'Ir', dest_type: 'url', dest_value: 'https://x.com' },
    ] } };
    const semZap = chamadasVisiveis(base({ home, contact: {} } as Partial<SiteInfo>), 'imob');
    expect(semZap.map(x => x.title)).toEqual(['Financiamento', 'Anuncie seu imóvel', 'Imóvel sob encomenda', 'Site']);
    expect(semZap.find(x => x.title === 'Site')).toMatchObject({ to: 'https://x.com', externo: true });
    const comZap = chamadasVisiveis(base({ home } as Partial<SiteInfo>), 'imob');
    expect(comZap.find(x => x.title === 'Zap')?.to).toMatch(/^https:\/\/wa\.me\/5511999990000/);
  });
});
