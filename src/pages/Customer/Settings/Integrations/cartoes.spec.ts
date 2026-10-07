import { describe, it, expect } from 'vitest';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import { CARTOES, itemDeIntegracoes, cartoesVisiveis, barraDoEndereco } from './cartoes';

// Monta a lista "já filtrada" com só as telas pedidas, como o MenuContext entrega.
const completo = getCustomerMenuSections();
const integracoesCompleto = completo.flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
function filtrado(hrefs: string[]): MenuSection[] {
  const item: MenuItem = { ...integracoesCompleto, abas: integracoesCompleto.abas!.filter(a => hrefs.includes(a.href)) };
  return [{ id: 'imobiliaria', rotulo: 'Minha imobiliária', itens: [item] }];
}
const TODAS = ['/channels', '/settings/facebook', '/settings/pixel-capi', '/settings/portals', '/settings/cvcrm'];

describe('cartões de Integrações', () => {
  it('os quatro cartões, nesta ordem, com as frases do desenho', () => {
    expect(CARTOES.map(c => [c.id, c.nome, c.frase])).toEqual([
      ['whatsapp', 'WhatsApp', 'Os números que atendem seus leads'],
      ['facebook', 'Facebook', 'Página dos anúncios e Pixel'],
      ['portais', 'Portais', 'ZAP, Imóvel Web e outros portais'],
      ['sistemas', 'Sistemas', 'Mande os leads pro sistema que você já usa'],
    ]);
  });

  it('itemDeIntegracoes acha o item pela entrada e devolve null quando ele foi filtrado', () => {
    expect(itemDeIntegracoes(filtrado(TODAS))?.name).toBe('Integrações');
    expect(itemDeIntegracoes([])).toBeNull();
  });

  it('com tudo liberado: quatro cartões; Facebook leva à Página, Sistemas à página própria', () => {
    const visiveis = cartoesVisiveis(itemDeIntegracoes(filtrado(TODAS)));
    expect(visiveis.map(v => [v.cartao.id, v.href])).toEqual([
      ['whatsapp', '/channels'],
      ['facebook', '/settings/facebook'],
      ['portais', '/settings/portals'],
      ['sistemas', '/settings/integrations/sistemas'],
    ]);
  });

  it('quem só vê o Pixel é levado ao endereço do Pixel', () => {
    const visiveis = cartoesVisiveis(itemDeIntegracoes(filtrado(['/settings/pixel-capi'])));
    expect(visiveis.map(v => [v.cartao.id, v.href])).toEqual([['facebook', '/settings/pixel-capi']]);
  });

  it('cartão sem nenhuma tela que sobrou não aparece; sem item, nenhum cartão', () => {
    expect(cartoesVisiveis(itemDeIntegracoes(filtrado(['/settings/portals']))).map(v => v.cartao.id)).toEqual(['portais']);
    expect(cartoesVisiveis(null)).toEqual([]);
  });
});

describe('barra do topo das telas de Integrações', () => {
  it('na entrada não tem barra (a entrada tem título próprio)', () => {
    expect(barraDoEndereco(filtrado(TODAS), '/settings/integrations')).toBeNull();
  });

  it('nas telas: ← Integrações + nome do cartão', () => {
    expect(barraDoEndereco(filtrado(TODAS), '/settings/pixel-capi')).toMatchObject({ voltarPara: '/settings/integrations', voltarRotulo: 'Integrações', nome: 'Facebook' });
    expect(barraDoEndereco(filtrado(TODAS), '/channels')).toMatchObject({ nome: 'WhatsApp' });
    expect(barraDoEndereco(filtrado(TODAS), '/settings/integrations/sistemas')).toMatchObject({ voltarPara: '/settings/integrations', nome: 'Sistemas' });
  });

  it('no CVCRM volta pra Sistemas', () => {
    expect(barraDoEndereco(filtrado(TODAS), '/settings/cvcrm')).toMatchObject({ voltarPara: '/settings/integrations/sistemas', voltarRotulo: 'Sistemas', nome: 'CVCRM' });
  });

  it('quem não vê Integrações (corretor em Meus números) fica sem barra', () => {
    expect(barraDoEndereco([], '/channels')).toBeNull();
  });

  it('endereço digitado de tela que o menu escondeu ainda ganha a barra se a pessoa vê a entrada', () => {
    // Painel raiz: a Página some do menu, o Pixel fica; o super digita /settings/facebook.
    expect(barraDoEndereco(filtrado(['/settings/pixel-capi']), '/settings/facebook')).toMatchObject({ nome: 'Facebook' });
  });
});
