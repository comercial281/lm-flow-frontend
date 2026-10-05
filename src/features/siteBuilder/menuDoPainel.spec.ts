import { describe, expect, it } from 'vitest';
import type { MenuDoPainel, SitePage } from '@/services/siteBuilder/siteBuilderService';
import {
  avisosDoExterno, menuComPagina, menuDeFabrica, menuDoPainel, menuParaGravar, menuSemPagina, nomeDeFabrica,
} from './menuDoPainel';

const ADMIN = {
  items: [
    { key: 'sale', label: 'Comprar imóvel', enabled: true },
    { key: 'rent', label: null, enabled: false },
    { key: 'launch', label: null, enabled: true },
    { key: 'about', label: null, enabled: true },
    { key: 'contact', label: null, enabled: true },
    { key: 'financing', label: null, enabled: true },
    { key: 'listing', label: null, enabled: true },
    { key: 'page:sobre', label: null, enabled: true, page_title: 'Sobre nós' },
    { key: 'page:rascunho', label: null, enabled: false, page_title: 'Rascunho' },
    { key: 'blog', label: null, enabled: true },
  ],
  external: [{ label: 'CRECI', url: 'https://creci.org.br' }],
  saved: true,
};

const pagina = (p: Partial<SitePage>): SitePage => ({
  id: 'p9', site_id: 's1', title: 'Nova', slug: 'nova', page_kind: 'portal_static', active: false, in_menu: false,
  created_at: '', updated_at: '', ...p,
});

describe('menuDoPainel', () => {
  it('lê o menu do admin com as páginas (ativas ou não) e o page_title', () => {
    const m = menuDoPainel(ADMIN);
    expect(m.items.map(i => i.key)).toEqual(ADMIN.items.map(i => i.key));
    expect(m.items.find(i => i.key === 'page:rascunho')).toEqual(
      { key: 'page:rascunho', label: null, enabled: false, page_title: 'Rascunho' });
    expect(m.external).toEqual([{ label: 'CRECI', url: 'https://creci.org.br/' }]);
  });

  it('servidor velho (sem menu) ou lixo = fábrica, na ordem de sempre', () => {
    for (const raw of [undefined, null, [], { items: 'x' }]) {
      expect(menuDoPainel(raw)).toEqual(menuDeFabrica());
    }
    expect(menuDeFabrica().items.map(i => i.key))
      .toEqual(['sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing', 'blog']);
  });

  it('nome de fábrica: o do topo de antes; página = o título dela', () => {
    expect(nomeDeFabrica({ key: 'about', page_title: null })).toBe('Sobre');
    expect(nomeDeFabrica({ key: 'listing', page_title: null })).toBe('Anuncie seu imóvel');
    expect(nomeDeFabrica({ key: 'page:sobre', page_title: 'Sobre nós' })).toBe('Sobre nós');
  });
});

describe('menuParaGravar', () => {
  it('item de página SEMPRE com enabled explícito, e sem page_title', () => {
    const g = menuParaGravar(menuDoPainel(ADMIN));
    const rascunho = g.items.find(i => i.key === 'page:rascunho')!;
    expect(rascunho).toEqual({ key: 'page:rascunho', label: null, enabled: false });
    expect(Object.prototype.hasOwnProperty.call(rascunho, 'enabled')).toBe(true);
    expect(g.items.every(i => !('page_title' in i))).toBe(true);
  });

  it('nome em branco vira null (nome de fábrica) e o nome é limpo', () => {
    const m = menuDoPainel(ADMIN);
    m.items[0] = { ...m.items[0], label: '   ' };
    m.items[1] = { ...m.items[1], label: ' Alugar\n agora ' };
    const g = menuParaGravar(m);
    expect(g.items[0].label).toBeNull();
    expect(g.items[1].label).toBe('Alugar agora');
  });

  it('domínio com acento vai convertido (o servidor recusaria o acento)', () => {
    const m: MenuDoPainel = { items: [], external: [{ label: 'Site', url: 'https://imobiliária.com.br/contato' }] };
    expect(menuParaGravar(m).external).toEqual([{ label: 'Site', url: 'https://xn--imobiliria-y4a.com.br/contato' }]);
  });

  it('externo sem nome ou fora de http(s) não viaja; no máximo 3', () => {
    const m: MenuDoPainel = {
      items: [],
      external: [
        { label: 'A', url: 'https://a.com' }, { label: '', url: 'https://b.com' },
        { label: 'C', url: 'www.c.com' }, { label: 'D', url: 'javascript:alert(1)' },
        { label: 'E', url: 'https://e.com' }, { label: 'F', url: 'https://f.com' }, { label: 'G', url: 'https://g.com' },
      ],
    };
    expect(menuParaGravar(m).external.map(e => e.label)).toEqual(['A', 'E', 'F']);
  });
});

describe('avisosDoExterno', () => {
  it('avisa endereço que não é http(s), sem endereço e sem nome', () => {
    expect(avisosDoExterno({ label: 'CRECI', url: 'www.creci.org.br' }).endereco).toMatch(/http:\/\/ ou https:\/\//);
    expect(avisosDoExterno({ label: 'CRECI', url: 'ftp://x.com' }).endereco).toMatch(/não é salvo/);
    expect(avisosDoExterno({ label: 'CRECI', url: '' }).endereco).toBe('Sem endereço, o link não é salvo.');
    expect(avisosDoExterno({ label: ' ', url: 'https://x.com' }).nome).toBe('Sem nome, o link não é salvo.');
    expect(avisosDoExterno({ label: 'CRECI', url: 'https://imobiliária.com.br' })).toEqual({ nome: null, endereco: null });
    expect(avisosDoExterno({ label: 'CRECI', url: 'https://fulano:senha@creci.org.br' }).endereco)
      .toBe('Endereço com usuário ou senha não é salvo.');
    expect(menuParaGravar({ items: [], external: [{ label: 'CRECI', url: 'https://fulano@creci.org.br' }] }).external).toEqual([]);
  });
});

describe('menuComPagina / menuSemPagina (tela Páginas mexeu)', () => {
  it('página nova entra depois da última página, com o in_menu dela', () => {
    const m = menuComPagina(menuDoPainel(ADMIN), pagina({ slug: 'nova', title: 'Nova', in_menu: true }));
    const keys = m.items.map(i => i.key);
    expect(keys.indexOf('page:nova')).toBe(keys.indexOf('page:rascunho') + 1);
    expect(m.items.find(i => i.key === 'page:nova')).toMatchObject({ enabled: true, page_title: 'Nova', label: null });
  });

  it('sem páginas, a nova entra depois do Anuncie (antes do Blog)', () => {
    const m = menuComPagina(menuDeFabrica(), pagina({ slug: 'x', title: 'X' }));
    expect(m.items.map(i => i.key).slice(-3)).toEqual(['listing', 'page:x', 'blog']);
  });

  it('salvar a página atualiza o liga/desliga e o nome de fábrica, mantendo o nome e a posição', () => {
    const base = menuDoPainel(ADMIN);
    base.items = base.items.map(i => (i.key === 'page:sobre' ? { ...i, label: 'Quem somos' } : i));
    const m = menuComPagina(base, pagina({ slug: 'sobre', title: 'Sobre a imobiliária', in_menu: false }), 'sobre');
    const item = m.items.find(i => i.key === 'page:sobre')!;
    expect(item).toMatchObject({ enabled: false, page_title: 'Sobre a imobiliária', label: 'Quem somos' });
    expect(m.items.map(i => i.key)).toEqual(base.items.map(i => i.key));
  });

  it('endereço trocado: o item antigo some e o novo perde o nome e a posição', () => {
    const base = menuDoPainel(ADMIN);
    base.items = [base.items[7], ...base.items.filter((_, i) => i !== 7)].map(i =>
      (i.key === 'page:sobre' ? { ...i, label: 'Quem somos' } : i));
    const m = menuComPagina(base, pagina({ slug: 'quem-somos', title: 'Sobre nós', in_menu: true }), 'sobre');
    expect(m.items.some(i => i.key === 'page:sobre')).toBe(false);
    const keys = m.items.map(i => i.key);
    expect(keys.indexOf('page:quem-somos')).toBe(keys.indexOf('page:rascunho') + 1);
    expect(m.items.find(i => i.key === 'page:quem-somos')!.label).toBeNull();
  });

  it('landing de anúncio não entra; excluir tira o item', () => {
    const base = menuDoPainel(ADMIN);
    expect(menuComPagina(base, pagina({ slug: 'lp', page_kind: 'ad_landing' }))).toBe(base);
    expect(menuSemPagina(base, 'sobre').items.some(i => i.key === 'page:sobre')).toBe(false);
  });
});
