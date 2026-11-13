import { describe, it, expect } from 'vitest';
import type { PortalProperty } from '@/pages/Public/portalShared';
import { resolverHome } from './homeConfig';
import { atalhosAutomaticos, atalhosDoSite, fotoDoAtalho } from './maisBuscados';
import { abasVisiveis } from './vitrines';
import type { AbaId } from './homeConfig';

const TODAS: AbaId[] = ['sale', 'rent', 'launch'];

const p = (code: string, type: string, hood: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: type, address: { city: 'Campinas', neighborhood: hood },
  sale_price_from: 300000, ...o });
const manual = (...items: Record<string, unknown>[]) => resolverHome({ most_searched: { mode: 'manual', items: items.map(a => ({
  transaction: 'sale', property_type: null, city: null, neighborhood: null, price_max: null, ...a })) } });

describe('mais buscados', () => {
  const items = [p('1','apartment','Cambuí'), p('2','apartment','Cambuí'), p('3','apartment','Cambuí'),
                 p('4','house','Barão Geraldo'), p('5','house','Barão Geraldo'), p('6','lot','Centro')];
  it('automático: combinações com 2+ imóveis, mais imóveis primeiro', () => {
    expect(atalhosAutomaticos(items)).toEqual([
      { label: 'Apartamentos em Cambuí', query: 'type=apartment&neighborhood=Cambu%C3%AD' },
      { label: 'Casas em Barão Geraldo', query: 'type=house&neighborhood=Bar%C3%A3o+Geraldo' },
    ]);
  });
  it('automático: sinônimos de tipo contam juntos e a busca leva uma chave só', () => {
    const lista = [p('1', 'penthouse', 'Cambuí'), p('2', 'cobertura', 'Cambuí')];
    expect(atalhosAutomaticos(lista)).toEqual([
      { label: 'Coberturas em Cambuí', query: 'type=penthouse&neighborhood=Cambu%C3%AD' },
    ]);
  });
  it('limite de 8', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => [p(`a${i}`, 'apartment', `B${i}`), p(`b${i}`, 'apartment', `B${i}`)]).flat();
    expect(atalhosAutomaticos(muitos).length).toBe(8);
  });
  it('manual vence; desligado → nada', () => {
    const manual = resolverHome({ most_searched: { mode: 'manual', items: [
      { label: 'Casas até 400 mil', transaction: 'sale', property_type: 'house', city: null, neighborhood: null, price_max: 400000 }] } });
    expect(atalhosDoSite(manual, items, TODAS)).toEqual([{ label: 'Casas até 400 mil', query: 'type=house&price_max=400000' }]);
    expect(atalhosDoSite(resolverHome({ most_searched: { enabled: false } }), items, TODAS)).toEqual([]);
  });
  it('manual: atalho cuja busca dá 0 imóvel some', () => {
    const h = manual({ label: 'Casas baratas', property_type: 'house', price_max: 100000 }, { label: 'Aluguel', transaction: 'rent' },
      { label: 'Terrenos', property_type: 'lot' });
    expect(atalhosDoSite(h, items, TODAS).map(a => a.label)).toEqual(['Terrenos']);
  });
  it('manual: cidade e bairro casam sem maiúscula/acento/espaço; finalidade nula conta como Comprar', () => {
    const h = manual({ label: 'Cambuí', city: 'CAMPÍNAS ', neighborhood: 'cambui' }, { label: 'Sem finalidade', transaction: null },
      { label: 'Santos', city: 'Santos' });
    expect(atalhosDoSite(h, items, TODAS)).toEqual([
      { label: 'Cambuí', query: 'city=CAMP%C3%8DNAS&neighborhood=cambui' },
      { label: 'Sem finalidade', query: '' },
    ]);
    // Finalidade nula é Comprar: imóvel só de aluguel não segura o atalho.
    expect(atalhosDoSite(manual({ label: 'X', transaction: null }), [p('L', 'house', 'Centro', { transaction_type: 'rent' })], TODAS)).toEqual([]);
  });

  describe('respeita as abas visíveis', () => {
    const catalogo = [...items, p('L1', 'house', 'Centro', { transaction_type: 'rent', rent_price_from: 2000 })];
    const h = manual({ label: 'Casas pra alugar', transaction: 'rent', property_type: 'house' },
      { label: 'Casas à venda', transaction: 'sale', property_type: 'house' }, { label: 'Qualquer', transaction: null });
    it('com as abas ligadas, os três aparecem', () => {
      expect(atalhosDoSite(h, catalogo, abasVisiveis(h, catalogo)).map(a => a.label)).toEqual(['Casas pra alugar', 'Casas à venda', 'Qualquer']);
    });
    it('atalho de aluguel some se Alugar não está visível (mesmo havendo imóvel de aluguel)', () => {
      const semAlugar = { ...h, search: { ...h.search, tabs: { ...h.search.tabs, rent: false } } };
      const abas = abasVisiveis(semAlugar, catalogo);
      expect(abas).toEqual(['sale']);
      expect(atalhosDoSite(semAlugar, catalogo, abas).map(a => a.label)).toEqual(['Casas à venda', 'Qualquer']);
    });
    it('atalho sem aba, ou de compra, some se Comprar não está visível', () => {
      const semComprar = { ...h, search: { ...h.search, tabs: { ...h.search.tabs, sale: false } } };
      const abas = abasVisiveis(semComprar, catalogo);
      expect(abas).toEqual(['rent']);
      expect(atalhosDoSite(semComprar, catalogo, abas).map(a => a.label)).toEqual(['Casas pra alugar']);
    });
    it('o automático não muda', () => {
      const auto = resolverHome({ search: { tabs: { sale: false, rent: false } } });
      expect(atalhosDoSite(auto, items, [])).toEqual(atalhosAutomaticos(items));
      expect(atalhosDoSite(auto, items, []).length).toBeGreaterThan(0);
    });
  });
});

describe('fotoDoAtalho (mosaico do Moderno)', () => {
  const foto = (code: string, type: string, hood: string, created_at: string | null, cover_url: string | null, o: Partial<PortalProperty> = {}) =>
    p(code, type, hood, { created_at, cover_url, ...o });

  it('foto = capa do imóvel mais recente que bate com o atalho; total = todos que batem', () => {
    const items = [
      foto('1', 'apartment', 'Cambuí', '2026-01-01T00:00:00Z', 'https://x/1.jpg'),
      foto('2', 'apartment', 'Cambuí', '2026-03-01T00:00:00Z', 'https://x/2.jpg'),
      foto('3', 'apartment', 'Cambuí', '2026-05-01T00:00:00Z', null), // mais recente, mas sem foto
      foto('4', 'house', 'Cambuí', '2026-09-01T00:00:00Z', 'https://x/4.jpg'), // outro tipo
      foto('5', 'apartment', 'Centro', '2026-09-01T00:00:00Z', 'https://x/5.jpg'), // outro bairro
    ];
    expect(fotoDoAtalho({ label: 'Apartamentos em Cambuí', query: 'type=apartment&neighborhood=Cambu%C3%AD' }, items))
      .toEqual({ url: 'https://x/2.jpg', total: 3 });
  });

  it('nenhum imóvel com foto: null', () => {
    const items = [foto('1', 'house', 'Centro', '2026-01-01T00:00:00Z', null), foto('2', 'house', 'Centro', null, '')];
    expect(fotoDoAtalho({ label: 'Casas', query: 'type=house' }, items)).toBeNull();
  });

  it('lê a busca do atalho como a página de busca: aluguel, preço máximo e cidade', () => {
    const items = [
      foto('V', 'house', 'Centro', '2026-09-01T00:00:00Z', 'https://x/v.jpg', { sale_price_from: 300000 }),
      foto('L1', 'house', 'Centro', '2026-01-01T00:00:00Z', 'https://x/l1.jpg', { transaction_type: 'rent', rent_price_from: 2000 }),
      foto('L2', 'house', 'Centro', '2026-02-01T00:00:00Z', 'https://x/l2.jpg', { transaction_type: 'rent', rent_price_from: 9000 }),
    ];
    expect(fotoDoAtalho({ label: 'Aluguel até 3 mil', query: 'tab=rent&type=house&city=campinas&price_max=3000' }, items))
      .toEqual({ url: 'https://x/l1.jpg', total: 1 });
  });

  it('atalho sem aba segue a aba da busca: site só de aluguel lê como Alugar', () => {
    const items = [
      foto('L1', 'apartment', 'Cambuí', '2026-01-01T00:00:00Z', 'https://x/l1.jpg', { transaction_type: 'rent', rent_price_from: 2000 }),
      foto('L2', 'apartment', 'Cambuí', '2026-04-01T00:00:00Z', 'https://x/l2.jpg', { transaction_type: 'rent', rent_price_from: 3000 }),
      foto('L3', 'apartment', 'Cambuí', '2026-06-01T00:00:00Z', null, { transaction_type: 'season', rent_price_from: 500 }),
    ];
    const [atalho] = atalhosAutomaticos(items);
    expect(atalho.query).not.toContain('tab=');
    expect(fotoDoAtalho(atalho, items, ['rent'])).toEqual({ url: 'https://x/l2.jpg', total: 3 });
    // Sem as abas, a regra de antes (Comprar) continua.
    expect(fotoDoAtalho(atalho, items)).toBeNull();
  });

  it('aba da query que o site não mostra cai na primeira visível, como na busca', () => {
    const items = [foto('L1', 'house', 'Centro', '2026-01-01T00:00:00Z', 'https://x/l1.jpg', { transaction_type: 'rent', rent_price_from: 2000 })];
    expect(fotoDoAtalho({ label: 'Casas', query: 'tab=sale&type=house' }, items, ['rent'])).toEqual({ url: 'https://x/l1.jpg', total: 1 });
  });
});
