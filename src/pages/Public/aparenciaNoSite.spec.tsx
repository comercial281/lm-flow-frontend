import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalFooter, PortalHeader, tokensDoSite, type SiteInfo } from './portalShared';
import PortalHomePage from './PortalHomePage';
import HomeCapa from './home/HomeCapa';
import SelosDoImovel from './ficha/SelosDoImovel';
import { resolverHome } from '@/features/siteBuilder/public/homeConfig';
import { APARENCIA_FABRICA, DEGRADE_DA_CAPA_FABRICA, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';

/* ────────────────────────────────────────────────────────────────────────────
   Meu site › Aparência no site público (C3): fundo, topo, faixa de cima, capa,
   rodapé, crédito, cor de destaque. O site sem `appearance` (servidor velho,
   cliente que nunca abriu a tela) sai com o DOM e as classes de antes.
──────────────────────────────────────────────────────────────────────────── */

const LOGO = 'https://cdn.x/logo.png';
const CLARA = 'https://cdn.x/clara.png';

const base: SiteInfo = {
  name: 'Imob Teste',
  branding: { logo_url: LOGO, primary_color: '#0E7C5A', accent_color: '#9333EA' },
  contact: { phone: '(11) 3333-4444', email: 'contato@imob.com.br', whatsapp: '5511999990000' },
  social_links: { instagram: 'https://instagram.com/imob' },
};
const comAp = (ap: Partial<Aparencia>, extra: Partial<SiteInfo> = {}): SiteInfo => ({ ...base, ...extra, appearance: { ...APARENCIA_FABRICA, ...ap } });

const rolar = (px: number) => {
  Object.defineProperty(window, 'scrollY', { value: px, writable: true, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
};

async function montar(el: React.ReactElement) {
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<MemoryRouter>{el}</MemoryRouter>); });
  return out.container;
}
const topo = (site: SiteInfo, onHome = false) => montar(<PortalHeader site={site} tenant="imob" onHome={onHome} />);
const rodape = (site: SiteInfo) => montar(<PortalFooter site={site} tenant="imob" />);
const capa = (site: SiteInfo) => montar(
  <HomeCapa site={site} home={resolverHome(undefined)} items={[]} tenant="imob" abas={['sale', 'rent']} cities={[]} hoods={[]} types={[]} />,
);
const html = async (p: Promise<HTMLElement>) => { const h = (await p).innerHTML; cleanup(); return h; };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) }));
  rolar(0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('site sem appearance: o de antes', () => {
  it('topo, rodapé e capa saem iguais com e sem a aparência de fábrica', async () => {
    const fabrica = comAp({});
    expect(await html(topo(base))).toBe(await html(topo(fabrica)));
    expect(await html(topo(base, true))).toBe(await html(topo(fabrica, true)));
    expect(await html(rodape(base))).toBe(await html(rodape(fabrica)));
    expect(await html(capa(base))).toBe(await html(capa(fabrica)));
  });

  it('topo: transparente sobre a capa com a logo branca, sólido de vidro fosco ao rolar e nas internas', async () => {
    const c = await topo(base, true);
    expect(c.querySelector('header')!.className).toBe('border-b transition-colors duration-300 border-white/15 bg-gradient-to-b from-black/40 to-transparent');
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(LOGO);
    expect(c.querySelector('header img')!.className).toContain('brightness-0 invert');
    rolar(400);
    expect(c.querySelector('header')!.className).toBe('border-b transition-colors duration-300 border-black/[0.06] bg-[var(--paper)]/90 backdrop-blur-md');
    expect(c.querySelector('header img')!.className).not.toContain('invert');
  });

  it('faixa de cima nas internas: telefone, e-mail e redes pelo nome', async () => {
    const c = await topo(base);
    expect(c.querySelector('a[href^="tel:"]')).toHaveTextContent('(11) 3333-4444');
    expect(c.querySelector('a[href^="mailto:"]')).toHaveTextContent('contato@imob.com.br');
    expect(within(c).getByText('Instagram')).toBeInTheDocument();
  });

  it('rodapé em colunas com a frase de sempre; capa de meia tela com o degradê de sempre', async () => {
    const r = await rodape(base);
    expect(r.querySelector('footer > div')!.className).toBe('mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6');
    expect(within(r).getByText('Seu portal de imóveis com atendimento de verdade.')).toBeInTheDocument();
    expect(within(r).getByText('Institucional')).toBeInTheDocument();
    cleanup();

    const s = (await capa(base)).querySelector('section')!;
    expect(s.className).toBe('relative overflow-hidden');
    expect(s.querySelector('div.relative')!.className).toBe('relative mx-auto max-w-6xl px-4 pb-8 pt-32 sm:px-6 sm:pt-40 md:pb-16 md:pt-44');
    expect((s.querySelector('div.absolute.inset-0 > div.absolute') as HTMLElement).style.background)
      .toBe((() => { const d = document.createElement('div'); d.style.background = DEGRADE_DA_CAPA_FABRICA; return d.style.background; })());
  });

  it('variáveis de sempre: fundo claro, sem data-fundo', () => {
    const t = tokensDoSite(base);
    expect(t.fundo).toBeUndefined();
    expect(t.cssVars).toMatchObject({ '--ink': '#17140F', '--paper': '#FAF7F2', '--solid': '#17140F', '--card': '#FFFFFF' });
  });
});

describe('fundo escuro', () => {
  it('troca --paper/--ink, põe as caixas no --card escuro e marca a raiz da página', async () => {
    const t = tokensDoSite(comAp({ background: 'dark' }));
    expect(t.fundo).toBe('escuro');
    expect(t.cssVars).toMatchObject({ '--paper': '#14110D', '--ink': '#F4EFE7', '--card': '#1E1A15' });
    expect(t.cssVars['--solid' as keyof typeof t.cssVars]).not.toBe('#F4EFE7');

    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/site/properties') || url.includes('/site/articles')
        ? { data: [], meta: { total: 0 } }
        : { data: comAp({ background: 'dark' }) }),
    })));
    render(
      <MemoryRouter initialEntries={['/portal/imob']}>
        <Routes><Route path="/portal/:tenant" element={<PortalHomePage />} /></Routes>
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    const raiz = h1.closest('[data-fundo]') as HTMLElement;
    expect(raiz).not.toBeNull();
    expect(raiz.getAttribute('data-fundo')).toBe('escuro');
    expect(raiz.style.getPropertyValue('--paper')).toBe('#14110D');
  });

  it('o globals.css cobre, no escuro, toda caixa branca e borda/anel/fundinho preto usados no site', () => {
    const css = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
    const arquivos = (dir: string): string[] => readdirSync(dir).flatMap(n => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? arquivos(p) : (/\.tsx$/.test(n) && !/\.spec\./.test(n) ? [p] : []);
    });
    const classes = new Set<string>();
    for (const f of arquivos(__dirname)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?<![\w:-])((?:hover:)?(?:bg-white(?:\/(?:85|95))?|border-black\/[\w.[\]]+|ring-black\/[\w.[\]]+|bg-black\/\[0\.0\d\]))(?![\w/[])/g)) classes.add(m[1]);
    }
    expect(classes.size).toBeGreaterThan(8);
    const escapar = (c: string) => c.replace(/([:/[\].])/g, '\\$1');
    const faltando = [...classes].filter(c => !css.includes(`:where([data-fundo='escuro']) .${escapar(c)}`));
    expect(faltando).toEqual([]);
  });
});

describe('estilo do topo', () => {
  it('na cor principal: sólido mesmo sobre a capa, texto pelo contraste e a logo clara', async () => {
    const c = await topo(comAp({ header_style: 'brand', logo_light_url: CLARA }), true);
    const header = c.querySelector('header')!;
    expect(header.className).toContain('bg-[var(--brand)]');
    expect(header.className).not.toContain('bg-gradient-to-b');
    expect(header.querySelector('img')!.getAttribute('src')).toBe(CLARA);
    expect(header.querySelector('img')!.className).not.toContain('invert');
    expect(within(header).getByRole('button', { name: 'Menu' }).className).toContain('text-[var(--brand-ink)]');
  });

  it('branco: sólido e branco desde o topo, com a logo normal', async () => {
    const c = await topo(comAp({ header_style: 'white', logo_light_url: CLARA }), true);
    const header = c.querySelector('header')!;
    expect(header.className).toContain('bg-[#FFFFFF]');
    expect(header.className).not.toContain('bg-gradient-to-b');
    expect(header.querySelector('img')!.getAttribute('src')).toBe(LOGO);
  });

  it('transparente com logo clara: a clara (sem filtro) sobre a capa e a normal depois de rolar', async () => {
    const c = await topo(comAp({ logo_light_url: CLARA }), true);
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(CLARA);
    expect(c.querySelector('header img')!.className).not.toContain('invert');
    rolar(400);
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(LOGO);
  });

  it('no fundo escuro, o topo sólido e o rodapé usam a logo clara; no claro, a normal', async () => {
    let c = await topo(comAp({ background: 'dark', logo_light_url: CLARA }));
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(CLARA);
    cleanup();
    c = await rodape(comAp({ background: 'dark', logo_light_url: CLARA }));
    expect(c.querySelector('footer img')!.getAttribute('src')).toBe(CLARA);
    cleanup();
    c = await rodape(comAp({ logo_light_url: CLARA }));
    expect(c.querySelector('footer img')!.getAttribute('src')).toBe(LOGO);
  });

  it('em manutenção o topo enxuto segue o estilo: na cor principal com a clara; transparente com a normal', async () => {
    let c = await topo(comAp({ header_style: 'brand', logo_light_url: CLARA }, { maintenance: true }));
    expect(c.querySelector('header')!.className).toContain('bg-[var(--brand)]');
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(CLARA);
    cleanup();
    c = await topo(comAp({ logo_light_url: CLARA }, { maintenance: true }));
    expect(c.querySelector('header')!.className).toBe('border-b border-black/[0.06] bg-[var(--paper)]/90 backdrop-blur-md');
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(LOGO);
  });
});

describe('faixa de cima', () => {
  it('um contato: só o telefone (o e-mail sai), redes ficam', async () => {
    const c = await topo(comAp({ top_bar: 'one_phone' }));
    expect(c.querySelector('a[href^="tel:"]')).toBeTruthy();
    expect(c.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(within(c).getByText('Instagram')).toBeInTheDocument();
  });

  it('um contato sem telefone: o e-mail', async () => {
    const c = await topo(comAp({ top_bar: 'one_phone' }, { contact: { email: 'contato@imob.com.br' } }));
    expect(c.querySelector('a[href^="mailto:"]')).toBeTruthy();
  });

  it('só ícones: os mesmos links sem texto, com o nome na dica e no leitor de tela', async () => {
    const c = await topo(comAp({ top_bar: 'icons' }));
    const tel = c.querySelector('a[href^="tel:"]')!;
    expect(tel.textContent).toBe('');
    expect(tel).toHaveAttribute('aria-label', 'Ligar para (11) 3333-4444');
    const insta = c.querySelector('a[href="https://instagram.com/imob"]')!;
    expect(insta.textContent).toBe('');
    expect(insta).toHaveAttribute('title', 'Instagram');
    expect(insta.querySelector('svg')).not.toBeNull();
  });

  it('escondida: nada de telefone, e-mail ou rede no topo', async () => {
    const c = await topo(comAp({ top_bar: 'hidden' }));
    expect(c.querySelector('a[href^="tel:"]')).toBeNull();
    expect(c.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(within(c).queryByText('Instagram')).toBeNull();
  });
});

describe('capa', () => {
  it('tela cheia ocupa a altura da tela', async () => {
    const s = (await capa(comAp({ hero_height: 'full' }))).querySelector('section')!;
    expect(s.className).toContain('min-h-[100svh]');
  });

  it('o filtro segue a força escolhida', async () => {
    const s = (await capa(comAp({ hero_overlay: 60 }))).querySelector('section')!;
    const filtro = (s.querySelector('div.absolute.inset-0 > div.absolute') as HTMLElement).style.background;
    expect(filtro).toMatch(/0\.5\)/);
    expect(filtro).toMatch(/0\.7\)/);
  });
});

describe('rodapé', () => {
  it('texto livre no lugar da frase de fábrica', async () => {
    const c = await rodape(comAp({ footer_text: 'Imóveis em Campinas desde 1990.' }));
    expect(within(c).getByText('Imóveis em Campinas desde 1990.')).toBeInTheDocument();
    expect(within(c).queryByText('Seu portal de imóveis com atendimento de verdade.')).toBeNull();
  });

  it('compacto: uma faixa com os links, sem as colunas', async () => {
    const c = await rodape(comAp({ footer_layout: 'compact' }));
    expect(within(c).queryByText('Institucional')).toBeNull();
    expect(c.querySelector('.sm\\:grid-cols-4')).toBeNull();
    const links = within(c).getByRole('navigation', { name: 'Links do rodapé' });
    expect(within(links).getByText('Comprar')).toBeInTheDocument();
    expect(within(c).getByText('Seu portal de imóveis com atendimento de verdade.')).toBeInTheDocument();
  });

  it.each(['columns', 'compact'] as const)('o crédito "feito com LM Flow" sempre aparece, com o link (%s)', async layout => {
    const c = await rodape(comAp({ footer_layout: layout, footer_text: 'Outra frase' }));
    const link = within(c).getByRole('link', { name: 'LM Flow' });
    expect(link).toHaveAttribute('href', 'https://lmflow.com.br');
    expect(link.parentElement).toHaveTextContent('© Imob Teste — feito com LM Flow.');
  });
});

describe('cor de destaque', () => {
  it('texto do selo escuro em destaque claro e branco em destaque escuro', () => {
    expect(tokensDoSite({ branding: { accent_color: '#FACC15' } }).cssVars).toMatchObject({ '--accent': '#FACC15', '--accent-ink': '#17140F' });
    expect(tokensDoSite({ branding: { accent_color: '#9333EA' } }).cssVars).toMatchObject({ '--accent-ink': '#FFFFFF' });
    // Sem destaque, a cor principal, como sempre.
    expect(tokensDoSite({ branding: { primary_color: '#0E7C5A' } }).cssVars).toMatchObject({ '--accent': '#0E7C5A' });
  });

  it('"Muito procurado" na ficha vai na --accent; os outros selos não', () => {
    render(<SelosDoImovel selos={[{ texto: 'Muito procurado', destaque: true }, { texto: 'Aceita FGTS', destaque: false }]} />);
    expect(screen.getByText('Muito procurado')).toHaveStyle({ background: 'var(--accent)', color: 'var(--accent-ink)' });
    expect(screen.getByText('Aceita FGTS').getAttribute('style')).toBeNull();
  });
});
