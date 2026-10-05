import { describe, expect, it } from 'vitest';
import type { SiteInfo } from '@/pages/Public/portalShared';
import { itensDoMenu, menuPersonalizado, resolverMenu, urlExterna, type ItemDoMenu } from './menuConfig';

const LMFLOW = { ctx: { tenant: 'imob', dominio: false } };
const DOMINIO = { ctx: { tenant: 'imob', dominio: true } };

const fixo = (key: string, extra: Partial<ItemDoMenu> = {}) => ({ key, label: null, enabled: true, ...extra });
/** O menu como o servidor manda pra quem nunca salvou (Task 7, "Menu de fábrica"). */
const FABRICA = ['sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing', 'blog'].map(k => fixo(k));
const comPagina = (itens: object[], pagina: object) => [...itens.slice(0, 7), pagina, ...itens.slice(7)];

/** Site com tudo que tem destino: as 3 abas, Sobre, Contato, Financiamento e Anuncie ligados. */
const base: SiteInfo = { financiamento: { enabled: true }, anuncie: { enabled: true } };
const rotulos = (site: SiteInfo, temBlog = true, abas?: ('sale' | 'rent' | 'launch')[]) =>
  itensDoMenu(site, abas, temBlog, LMFLOW).map(l => l.rotulo);

describe('itensDoMenu', () => {
  it('fábrica = os itens de hoje, na ordem de hoje (com e sem menu_config)', () => {
    const hoje = ['Comprar', 'Alugar', 'Lançamentos', 'Sobre', 'Contato', 'Financiamento', 'Anuncie seu imóvel', 'Quem somos', 'Blog'];
    const velho: SiteInfo = { ...base, menu: [{ title: 'Quem somos', slug: 'quem-somos' }] };
    expect(rotulos(velho)).toEqual(hoje);
    const novo: SiteInfo = { ...velho, menu_config: { items: comPagina(FABRICA, fixo('page:quem-somos', { page_title: 'Quem somos' })), external: [] } };
    expect(rotulos(novo)).toEqual(hoje);
    expect(itensDoMenu(novo, undefined, true, LMFLOW).map(l => l.href)).toEqual([
      '/portal/imob/imoveis?tab=sale', '/portal/imob/imoveis?tab=rent', '/portal/imob/imoveis?tab=launch',
      '/portal/imob#sobre', '/portal/imob#contato', '/portal/imob/financiamento', '/portal/imob/anuncie',
      '/portal/imob/p/quem-somos', '/portal/imob/blog',
    ]);
  });

  it('respeita a ordem trocada', () => {
    const items = [fixo('blog'), fixo('contact'), fixo('sale'), fixo('rent'), fixo('launch'), fixo('about'), fixo('financing'), fixo('listing')];
    expect(rotulos({ ...base, menu_config: { items, external: [] } }))
      .toEqual(['Blog', 'Contato', 'Comprar', 'Alugar', 'Lançamentos', 'Sobre', 'Financiamento', 'Anuncie seu imóvel']);
  });

  it('item desligado some', () => {
    const items = FABRICA.map(i => (i.key === 'rent' || i.key === 'about' ? { ...i, enabled: false } : i));
    const r = rotulos({ ...base, menu_config: { items, external: [] } });
    expect(r).not.toContain('Alugar');
    expect(r).not.toContain('Sobre');
    expect(r).toContain('Comprar');
  });

  it('rótulo trocado vale no lugar do nome de fábrica (e em página)', () => {
    const items = comPagina(FABRICA.map(i => (i.key === 'sale' ? { ...i, label: 'Comprar imóvel' } : i)),
      { key: 'page:sobre', label: 'Quem somos', enabled: true, page_title: 'Sobre nós' });
    const r = rotulos({ ...base, menu_config: { items, external: [] } });
    expect(r[0]).toBe('Comprar imóvel');
    expect(r).toContain('Quem somos');
    expect(r).not.toContain('Sobre nós');
  });

  it('externo que não é http(s) some; os bons abrem em outra aba, no fim', () => {
    const external = [
      { label: 'CRECI', url: 'https://creci.org.br' },
      { label: 'Script', url: 'javascript:alert(1)' },
      { label: 'FTP', url: 'ftp://arquivos.imob.com.br' },
      { label: 'Sem host', url: 'https://' },
      { label: '', url: 'https://semnome.com.br' },
    ];
    const l = itensDoMenu({ ...base, menu_config: { items: FABRICA, external } }, undefined, true, LMFLOW);
    const externos = l.filter(x => x.externo);
    expect(externos).toEqual([{ chave: 'externo:0', rotulo: 'CRECI', href: 'https://creci.org.br/', externo: true, ancora: false }]);
    expect(l[l.length - 1].rotulo).toBe('CRECI');
  });

  it('domínio com acento vira punycode no link externo', () => {
    const l = itensDoMenu({ menu_config: { items: FABRICA, external: [{ label: 'Parceiro', url: 'https://imobiliária.com.br/contato' }] } }, undefined, false, LMFLOW);
    expect(l.find(x => x.externo)!.href).toBe('https://xn--imobiliria-y4a.com.br/contato');
  });

  it('blog sem artigo some', () => {
    expect(rotulos({ ...base, menu_config: { items: FABRICA, external: [] } }, false)).not.toContain('Blog');
    expect(rotulos({ ...base, menu_config: { items: FABRICA, external: [] } }, true)).toContain('Blog');
  });

  it('some o item sem destino: aba sem imóvel, seção desligada, Financiamento e Anuncie desligados', () => {
    const site: SiteInfo = { sections: { stats: false, lead_capture: false }, menu_config: { items: FABRICA, external: [] } };
    expect(rotulos(site, false, ['rent'])).toEqual(['Alugar']);
  });

  it('página só entra com page_title (o servidor confirmou que existe e está ativa) e ligada', () => {
    const items = [...FABRICA, fixo('page:sumiu'), fixo('page:desligada', { enabled: false, page_title: 'Desligada' }), fixo('page:ok', { page_title: 'Ok' })];
    expect(rotulos({ menu_config: { items, external: [] } }, false, [])).toEqual(['Sobre', 'Contato', 'Ok']);
  });

  it('no domínio do cliente os caminhos saem limpos; fora da home a seção volta pra home, na home é âncora', () => {
    const site: SiteInfo = { ...base, menu_config: { items: comPagina(FABRICA, fixo('page:quem somos', { page_title: 'Q' })), external: [] } };
    const naHome = itensDoMenu(site, undefined, true, { ...DOMINIO, onHome: true });
    expect(naHome.map(l => l.href)).toEqual(['/imoveis?tab=sale', '/imoveis?tab=rent', '/imoveis?tab=launch', '#sobre', '#contato', '/financiamento', '/anuncie', '/blog']);
    const ok: SiteInfo = { ...site, menu_config: { items: comPagina(FABRICA, fixo('page:quem-somos', { page_title: 'Q' })), external: [] } };
    expect(itensDoMenu(ok, undefined, false, DOMINIO).find(l => l.rotulo === 'Q')!.href).toBe('/p/quem-somos');
    expect(itensDoMenu(ok, undefined, false, DOMINIO).find(l => l.chave === 'about')).toMatchObject({ href: '/#sobre', ancora: true });
  });

  it('servidor velho: páginas da lista antiga, com o slug codificado', () => {
    const l = itensDoMenu({ menu: [{ title: 'Quem somos', slug: 'quem somos' }, { title: 'X', slug: '' }] }, [], false, DOMINIO);
    expect(l.filter(x => x.chave.startsWith('page:'))).toEqual([
      { chave: 'page:quem somos', rotulo: 'Quem somos', href: '/p/quem%20somos', externo: false, ancora: false },
    ]);
  });
});

describe('resolverMenu', () => {
  it('sem menu_config (servidor velho) ou lixo: null', () => {
    for (const raw of [undefined, null, [], 'menu', { items: 'x' }, { external: [] }]) expect(resolverMenu(raw)).toBeNull();
  });

  it('chave desconhecida ou repetida some; item fixo que falta entra depois da vizinha de fábrica', () => {
    const m = resolverMenu({ items: [fixo('blog'), fixo('sale'), fixo('sale', { enabled: false }), fixo('xpto'), fixo('page:Maiuscula'), fixo('launch')] })!;
    expect(m.items.map(i => i.key)).toEqual(['blog', 'sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing']);
    expect(m.items[1].enabled).toBe(true);
  });

  it('rótulo limpo (quebra, espaços, 40) e vazio vira null; enabled torto vale ligado; até 3 externos', () => {
    const m = resolverMenu({
      items: [{ key: 'sale', label: '  Comprar\n  já ', enabled: 'sim' }, { key: 'rent', label: '   ' }, { key: 'launch', label: 'x'.repeat(60) }],
      external: [1, 2, 3, 4].map(n => ({ label: `L${n}`, url: `https://l${n}.com.br` })),
    })!;
    expect(m.items.slice(0, 3).map(i => [i.label, i.enabled])).toEqual([['Comprar já', true], [null, true], ['x'.repeat(40), true]]);
    expect(m.external.map(e => e.label)).toEqual(['L1', 'L2', 'L3']);
  });
});

describe('urlExterna', () => {
  it('só http(s) com host', () => {
    expect(urlExterna('http://a.com')).toBe('http://a.com/');
    expect(urlExterna('mailto:a@b.com')).toBeNull();
    expect(urlExterna('/imoveis')).toBeNull();
    expect(urlExterna(`https://a.com/${'x'.repeat(2048)}`)).toBeNull();
  });
});

describe('menuPersonalizado', () => {
  const paginas = [{ title: 'A', slug: 'a' }, { title: 'B', slug: 'b' }];
  const fabrica = [...FABRICA.slice(0, 7), fixo('page:a', { page_title: 'A' }), fixo('page:b', { page_title: 'B' }), fixo('blog')];

  it('sem menu_config ou com o de fábrica: não (página desligada na tela Páginas não conta)', () => {
    expect(menuPersonalizado({ menu: paginas })).toBe(false);
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: fabrica, external: [] } })).toBe(false);
    const umaDesligada = fabrica.map(i => (i.key === 'page:b' ? { ...i, enabled: false } : i));
    expect(menuPersonalizado({ menu: [paginas[0]], menu_config: { items: umaDesligada, external: [] } })).toBe(false);
  });

  it('nome, desligar, ordem, externo ou ordem das páginas: sim', () => {
    const com = (items: object[], external: object[] = []) => menuPersonalizado({ menu: paginas, menu_config: { items, external } });
    expect(com(fabrica.map(i => (i.key === 'blog' ? { ...i, label: 'Notícias' } : i)))).toBe(true);
    expect(com(fabrica.map(i => (i.key === 'rent' ? { ...i, enabled: false } : i)))).toBe(true);
    expect(com([fabrica[1], fabrica[0], ...fabrica.slice(2)])).toBe(true);
    expect(com(fabrica, [{ label: 'CRECI', url: 'https://creci.org.br' }])).toBe(true);
    const bAntes = [...fabrica.slice(0, 7), fabrica[8], fabrica[7], fabrica[9]];
    expect(com(bAntes)).toBe(true);
    expect(com([...fabrica.slice(0, 7), fabrica[9], fabrica[7], fabrica[8]])).toBe(true);
  });
});

describe('saved (o cliente salvou a tela Menus)', () => {
  const paginas = [{ title: 'A', slug: 'a' }, { title: 'B', slug: 'b' }];
  const fabrica = [...FABRICA.slice(0, 7), fixo('page:a', { page_title: 'A' }), fixo('page:b', { page_title: 'B' }), fixo('blog')];

  it('resolverMenu devolve saved: true/false quando o servidor manda; null quando não manda', () => {
    expect(resolverMenu({ items: fabrica, external: [], saved: true })!.saved).toBe(true);
    expect(resolverMenu({ items: fabrica, external: [], saved: false })!.saved).toBe(false);
    expect(resolverMenu({ items: fabrica, external: [] })!.saved).toBeNull();
    expect(resolverMenu({ items: fabrica, external: [], saved: 'sim' })!.saved).toBeNull();
  });

  it('saved: true com o menu de fábrica: repete o menu', () => {
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: fabrica, external: [], saved: true } })).toBe(true);
  });

  it('saved: false com duas páginas na mesma posição (ordem diferente da lista antiga): o rodapé de antes', () => {
    const bAntes = [...fabrica.slice(0, 7), fabrica[8], fabrica[7], fabrica[9]];
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: bAntes, external: [], saved: false } })).toBe(false);
    // E nem um nome trocado vence o saved: false (o servidor é quem sabe).
    const renomeado = fabrica.map(i => (i.key === 'blog' ? { ...i, label: 'Notícias' } : i));
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: renomeado, external: [], saved: false } })).toBe(false);
  });

  it('servidor sem o campo: decide pela comparação com a fábrica', () => {
    const bAntes = [...fabrica.slice(0, 7), fabrica[8], fabrica[7], fabrica[9]];
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: bAntes, external: [] } })).toBe(true);
    expect(menuPersonalizado({ menu: paginas, menu_config: { items: fabrica, external: [] } })).toBe(false);
  });
});

describe('rótulo e link externo: casos de borda', () => {
  it('rótulo corta por caractere: emoji no limite não vira meio caractere', () => {
    const rotulo = `${'a'.repeat(39)}🏠🏠`;
    const m = resolverMenu({ items: [{ key: 'sale', label: rotulo }] })!;
    expect(m.items[0].label).toBe(`${'a'.repeat(39)}🏠`);
    expect([...m.items[0].label!]).toHaveLength(40);
    expect(m.items[0].label!.endsWith('\uD83C')).toBe(false);
  });

  it('endereço com usuário ou senha não vale', () => {
    expect(urlExterna('https://fulano@creci.org.br')).toBeNull();
    expect(urlExterna('https://fulano:senha@creci.org.br')).toBeNull();
    expect(urlExterna('https://:senha@creci.org.br')).toBeNull();
    expect(urlExterna('https://creci.org.br/a@b')).toBe('https://creci.org.br/a@b');
  });
});
