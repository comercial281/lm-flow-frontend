import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalFooter, PortalHeader, tokensDoSite, type PortalProperty, type SiteInfo } from './portalShared';
import PortalHomePage from './PortalHomePage';
import PortalCustomPage from './PortalCustomPage';
import HomeCapa from './home/HomeCapa';
import SelosDoImovel from './ficha/SelosDoImovel';
import { resolverHome } from '@/features/siteBuilder/public/homeConfig';
import { APARENCIA_FABRICA, DEGRADE_DA_CAPA_FABRICA, contrasteEntre, fonteDoSite, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';

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

// O DOM de antes do C3 (fixtures do c72c0c39) é conferido em molduraAntesDoC3.spec.tsx.
describe('site sem appearance: o de antes', () => {
  it('a aparência de fábrica explícita (o que o servidor novo manda) sai igual a nenhuma', async () => {
    const fabrica = comAp({});
    expect(await html(topo(base))).toBe(await html(topo(fabrica)));
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
    expect(t.cssVars).toMatchObject({ '--ink': '#17140F', '--paper': '#FAF7F2', '--solid': '#17140F', '--site-card': '#FFFFFF', '--brand-text': '#0E7C5A' });
    expect(t.cssVars).not.toHaveProperty('--card');
  });
});

describe('fundo escuro', () => {
  it('troca --paper/--ink, põe as caixas no --card escuro e marca a raiz da página', async () => {
    const t = tokensDoSite(comAp({ background: 'dark' }));
    expect(t.fundo).toBe('escuro');
    expect(t.cssVars).toMatchObject({ '--paper': '#14110D', '--ink': '#F4EFE7', '--site-card': '#1E1A15' });
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

  it.each(['#1E3A8A', '#7C3AED', '#0E7C5A'])('texto na cor da marca %s fica legível (≥ 4,5:1) no fundo escuro e é a própria marca no claro', brand => {
    const escuro = tokensDoSite(comAp({ background: 'dark' }, { branding: { primary_color: brand } })).cssVars as Record<string, string>;
    const texto = escuro['--brand-text'];
    expect(contrasteEntre(texto, '#14110D')).toBeGreaterThanOrEqual(4.5);
    expect(contrasteEntre(texto, escuro['--site-card'])).toBeGreaterThanOrEqual(4.5);
    expect(escuro['--brand']).toBe(brand);
    const claro = tokensDoSite({ branding: { primary_color: brand } }).cssVars as Record<string, string>;
    expect(claro['--brand-text']).toBe(brand);
  });

  it('marca que já é clara não muda no escuro; o texto do artigo e da página usa --brand-text', () => {
    const t = tokensDoSite(comAp({ background: 'dark' }, { branding: { primary_color: '#FACC15' } })).cssVars as Record<string, string>;
    expect(t['--brand-text']).toBe('#FACC15');
    for (const f of ['PortalArticlePage.tsx', 'PortalCustomPage.tsx']) {
      expect(readFileSync(join(__dirname, f), 'utf8')).toContain('a{color:var(--brand-text)');
    }
  });

  it('a citação do artigo continua #555 no claro e vira a tinta a 70% só no escuro', () => {
    expect(readFileSync(join(__dirname, 'PortalArticlePage.tsx'), 'utf8')).toContain('blockquote{margin:1.2em 0;padding-left:1em;border-left:3px solid var(--brand);color:#555;');
    const regras = regrasDoEscuro();
    expect(regras.some(r => /article-body blockquote/.test(r.seletor) && /color-mix\(in oklab,\s*var\(--ink\) 70%, transparent\)/.test(r.corpo))).toBe(true);
  });

  it('a raiz da página e o "Carregando página…" (site já conhecido) saem com data-fundo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/site/pages/')) return new Promise(() => {}); // a página nunca chega
      return { ok: true, json: async () => (url.includes('/site/properties') || url.includes('/site/articles')
        ? { data: [], meta: { total: 0 } } : { data: comAp({ background: 'dark' }) }) };
    }));
    render(
      <MemoryRouter initialEntries={['/portal/imob/p/sobre']}>
        <Routes><Route path="/portal/:tenant/p/:slug" element={<PortalCustomPage />} /></Routes>
      </MemoryRouter>,
    );
    const carregando = await screen.findByText('Carregando página…');
    expect(carregando.closest('[data-fundo]')?.getAttribute('data-fundo')).toBe('escuro');
  });

  it('o globals.css cobre, no escuro, toda cor fixa clara/escura usada no site (com prefixos)', () => {
    const cobertas = classesCobertas();
    const faltando = [...classesDoSite()].filter(c => !cobertas.has(c));
    expect(faltando).toEqual([]);
  });

  it('a trava reprova classe nova sem regra (prefixos e caixas de cor inclusive)', () => {
    const cobertas = classesCobertas();
    for (const c of ['sm:bg-white', 'group-hover:bg-white', 'bg-white/90', 'bg-emerald-50', 'bg-sky-100', 'text-blue-700', 'md:border-black/[0.09]', 'hover:bg-black/[0.02]']) {
      expect(alvo(c)).toBe(true);
      expect(cobertas.has(c)).toBe(false);
    }
    expect(alvo('bg-black/45')).toBe(false);
    expect(alvo('bg-white/15')).toBe(false);
    expect(cobertas.has('bg-red-50')).toBe(true);
    expect(cobertas.has('hover:text-neutral-600')).toBe(true);
    expect(cobertas.has('text-neutral-600')).toBe(true);
    expect(cobertas.has('hover:text-[var(--brand)]')).toBe(true);
    expect(cobertas.has('group-hover:text-[var(--brand)]')).toBe(true);
  });
});

/* ── Trava do fundo escuro: o que o site usa × o que o globals.css cobre ─────
   Lê o CSS por regras (seletor + corpo), sem depender de espaço, aspas nem
   ordem: conta como coberta a classe que é o alvo de um seletor com
   [data-fundo=escuro] (o último `.classe` do seletor, desescapado) e toda
   classe de cor cuja variável `--color-<cor>-<tom>` o escuro redefine. */
const CSS = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function regrasDoEscuro(): { seletor: string; corpo: string }[] {
  const out: { seletor: string; corpo: string }[] = [];
  for (const m of CSS.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    if (/\[data-fundo\s*=\s*['"]?escuro['"]?\s*\]/.test(m[1])) out.push({ seletor: m[1].trim(), corpo: m[2] });
  }
  return out;
}

const desescapar = (c: string) => c.replace(/\\(.)/g, '$1');

function classesCobertas(): Set<string> {
  const ok = new Set<string>();
  const coresTrocadas = new Set<string>();
  for (const { seletor, corpo } of regrasDoEscuro()) {
    for (const parte of seletor.split(',')) {
      const classes = [...parte.matchAll(/\.((?:\\.|[\w-])+)/g)].map(m => desescapar(m[1]));
      if (classes.length) ok.add(classes[classes.length - 1]);
    }
    for (const m of corpo.matchAll(/--color-([a-z]+-\d+)\s*:/g)) coresTrocadas.add(m[1]);
  }
  // Classe de cor do Tailwind (bg-/text-/border-/ring-<cor>-<tom>), com ou sem
  // prefixo e opacidade, lê `var(--color-<cor>-<tom>)`: trocada a variável, coberta.
  for (const c of classesDoSite()) {
    const m = /^(?:[\w-]+:)*(?:bg|text|border|ring)-([a-z]+-\d+)(?:\/\d+)?$/.exec(c);
    if (m && coresTrocadas.has(m[1])) ok.add(c);
  }
  return ok;
}

/**
 * Classes que somem ou mancham no fundo escuro: caixa branca (opaca ou quase),
 * borda/anel preto, fundinho preto sutil (hover), a cor da marca como texto,
 * caixas claras de cor e texto escuro de cor. Véu sobre foto (`bg-black/45`,
 * `bg-white/15` da galeria) não entra: é sobre a foto, não sobre o fundo.
 */
function alvo(classe: string): boolean {
  const base = classe.replace(/^(?:[\w-]+:)+/, '');
  return /^bg-white(\/([5-9]\d|100))?$/.test(base)
    || /^(border|ring)-black\/\S+$/.test(base)
    || /^bg-black\/\[0\.0\d+\]$/.test(base)
    || base === 'text-[var(--brand)]'
    || /^bg-(?!white|black)[a-z]+-(50|100|200)$/.test(base)
    || /^text-(?!white|black)[a-z]+-(600|700|800|900)$/.test(base)
    || /^bg-\[var\(--ink\)\]$/.test(base);
}

/** Varre os .tsx do site público (fora a pesquisa de satisfação, a landing e o "Site não encontrado", que não usam as cores do site). */
function classesDoSite(): Set<string> {
  const fora = /(^|\/)(Survey\/|Landing|SiteNaoEncontrado)/;
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx$/.test(n) && !/\.spec\./.test(n) && !fora.test(p.slice(__dirname.length + 1)) ? [p] : [];
  });
  const classes = new Set<string>();
  for (const f of arquivos(__dirname)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(?<=^|[\s'"`{])((?:[\w-]+:)*[a-z][\w-]*(?:-\[[^\]\s'"`]+\])?(?:\/(?:\[[\d.]+\]|\d+))?)(?=$|[\s'"`}])/gm)) {
      if (alvo(m[1])) classes.add(m[1]);
    }
  }
  return classes;
}

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

  it('na cor principal CLARA: texto escuro e a logo normal (a clara sumiria)', async () => {
    const c = await topo(comAp({ header_style: 'brand', logo_light_url: CLARA }, { branding: { logo_url: LOGO, primary_color: '#FACC15' } }), true);
    expect(c.querySelector('header img')!.getAttribute('src')).toBe(LOGO);
    expect(tokensDoSite({ branding: { primary_color: '#FACC15' } }).cssVars).toMatchObject({ '--brand-ink': '#17140F' });
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

  it('texto livre mantém as quebras de linha nos dois layouts', async () => {
    for (const layout of ['columns', 'compact'] as const) {
      const c = await rodape(comAp({ footer_layout: layout, footer_text: 'Linha 1\nLinha 2' }));
      expect(within(c).getByText(/Linha 1/).className).toContain('whitespace-pre-line');
      cleanup();
    }
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

/* ── Modelo do site (D2): fonte dos títulos, menu, capa dividida, cartões ── */

const resp = (body: unknown) => ({ ok: true, json: async () => body });
async function abrirHome(site: SiteInfo, items: PortalProperty[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resp({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resp({ data: [], meta: { total: 0 } });
    return resp({ data: site });
  }));
  const out = render(
    <MemoryRouter initialEntries={['/portal/imob']}>
      <Routes><Route path="/portal/:tenant" element={<PortalHomePage />} /></Routes>
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  return { container: out.container, raiz: h1.closest('[data-fundo], [style]') as HTMLElement };
}
const linksDeFonte = (c: HTMLElement) => [...c.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href'));
const href = (f: string) => fonteDoSite(f).fontHref;

describe('fonte dos títulos', () => {
  it('Playfair nos títulos com DM Sans no corpo: dois <link> de fonte, --display na Playfair e o corpo em DM Sans', async () => {
    const { container, raiz } = await abrirHome(comAp({ heading_font: 'Playfair Display' }, { branding: { ...base.branding, font_family: 'DM Sans' } }));
    expect(linksDeFonte(container)).toEqual([href('DM Sans'), href('Playfair Display')]);
    expect(raiz.style.getPropertyValue('--display')).toBe('Playfair Display, Georgia, serif');
    expect(raiz.style.fontFamily).toMatch(/^"?DM Sans"?, system-ui, sans-serif$/);
  });

  it('sem fonte dos títulos (servidor velho ou nulo): um <link> só e --display igual ao corpo, como hoje', async () => {
    for (const site of [{ ...base, branding: { ...base.branding, font_family: 'Montserrat' } }, comAp({ heading_font: null }, { branding: { ...base.branding, font_family: 'Montserrat' } })]) {
      const { container, raiz } = await abrirHome(site);
      expect(linksDeFonte(container)).toEqual([href('Montserrat')]);
      expect(raiz.style.getPropertyValue('--display')).toBe('Montserrat, system-ui, sans-serif');
      cleanup();
    }
  });

  it('tokensDoSite entrega os endereços e o --display; nenhuma página monta mais o <link> com um endereço só', () => {
    const t = tokensDoSite(comAp({ heading_font: 'Playfair Display' }, { branding: { font_family: 'DM Sans' } }));
    expect(t.fontHrefs).toEqual([href('DM Sans'), href('Playfair Display')]);
    expect(t.cssVars).toMatchObject({ '--display': 'Playfair Display, Georgia, serif', fontFamily: 'DM Sans, system-ui, sans-serif' });
    const paginas = readdirSync(__dirname).filter(n => /\.tsx$/.test(n) && !/\.spec\./.test(n) && !/^Landing/.test(n));
    const comFonte = paginas.filter(n => readFileSync(join(__dirname, n), 'utf8').includes('fontHrefs'));
    expect(comFonte.sort()).toEqual(['ImovelPublicPage.tsx', 'PaginaManutencao.tsx', 'PortalAnunciePage.tsx', 'PortalArticlePage.tsx',
      'PortalBlogPage.tsx', 'PortalCustomPage.tsx', 'PortalFinanciamentoPage.tsx', 'PortalHomePage.tsx', 'PortalSearchPage.tsx', 'portalShared.tsx']);
    for (const n of paginas) expect(readFileSync(join(__dirname, n), 'utf8'), n).not.toMatch(/href=\{fontHref\}/);
  });

  it('a classe font-[var(--display)] troca a FAMÍLIA (no Tailwind 4 ela sozinha vira peso): regra no globals.css', () => {
    expect(CSS).toMatch(/\.font-\\\[var\\\(--display\\\)\\\]\s*\{\s*font-family:\s*var\(--display\);?\s*\}/);
  });
});

describe('menu do topo', () => {
  const linksDoMenu = (c: HTMLElement) => within(c.querySelector('header nav') as HTMLElement).getAllByRole('link');

  it('maiúsculas: os links do topo em caixa alta, espaçados e com 13px', async () => {
    const c = await topo(comAp({ menu_style: 'caps' }));
    const links = linksDoMenu(c);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l).toHaveClass('uppercase', 'tracking-[0.14em]', 'text-[13px]');
      expect(l).not.toHaveClass('text-[14px]');
    }
  });

  it.each(['transparent', 'brand', 'white'] as const)('normal: os links de sempre (%s)', async header_style => {
    const normal = await html(topo(comAp({ header_style, menu_style: 'normal' }), true));
    expect(normal).toBe(await html(topo(comAp({ header_style }), true)));
    const c = await topo(comAp({ header_style }), true);
    for (const l of linksDoMenu(c)) {
      expect(l).toHaveClass('text-[14px]');
      expect(l).not.toHaveClass('uppercase');
    }
  });
});

describe('capa dividida', () => {
  it('duas colunas a partir do md: texto e busca de um lado, a foto num quadro arredondado do outro', async () => {
    const s = (await capa(comAp({ hero_layout: 'split' }, { hero: { image_url: 'https://cdn.x/capa.jpg' } }))).querySelector('section')!;
    const grade = s.querySelector('.md\\:grid-cols-2') as HTMLElement;
    expect(grade).not.toBeNull();
    const [texto, quadro] = [...grade.children] as HTMLElement[];
    // Celular: texto e busca primeiro, a foto depois, com 240px.
    expect(within(texto).getByRole('heading', { level: 1 })).toHaveTextContent('O imóvel certo pra sua próxima fase.');
    expect(texto.querySelector('form')).not.toBeNull();
    expect(within(texto).getByRole('button', { name: /Buscar/ })).toBeInTheDocument();
    expect(quadro.querySelector('img')!.getAttribute('src')).toBe('https://cdn.x/capa.jpg');
    expect(quadro).toHaveClass('h-[240px]', 'overflow-hidden');
    expect(quadro.className).toMatch(/\brounded-\[/);
    expect(quadro.querySelector('form')).toBeNull();
    // Sem o filtro escuro: o texto não fica sobre a foto.
    expect([...s.querySelectorAll<HTMLElement>('div')].some(d => d.style.background.includes('gradient'))).toBe(false);
    // Texto na tinta do site, não branco.
    expect(within(texto).getByRole('heading', { level: 1 }).className).not.toMatch(/text-white/);
  });

  it('vídeo do banner vai no quadro', async () => {
    const s = (await capa(comAp({ hero_layout: 'split' }, { hero: { video_url: 'https://cdn.x/capa.mp4' } }))).querySelector('section')!;
    const quadro = s.querySelector('.md\\:grid-cols-2')!.children[1] as HTMLElement;
    expect(quadro.querySelector('video')!.getAttribute('src')).toBe('https://cdn.x/capa.mp4');
  });

  it('a busca é a mesma da capa de foto (mesmo formulário, mesmas classes)', async () => {
    const dividida = (await capa(comAp({ hero_layout: 'split' }))).querySelector('form')!.outerHTML;
    cleanup();
    expect((await capa(comAp({ hero_layout: 'photo' }))).querySelector('form')!.outerHTML).toBe(dividida);
  });

  it('foto (padrão): a capa de sempre', async () => {
    expect(await html(capa(comAp({ hero_layout: 'photo' })))).toBe(await html(capa(base)));
  });

  it('o topo transparente não flutua em branco sobre a capa dividida (o fundo ali é o do site)', async () => {
    const c = await topo(comAp({ hero_layout: 'split' }), true);
    expect(c.querySelector('header')!.className).toBe('border-b transition-colors duration-300 border-black/[0.06] bg-[var(--paper)]/90 backdrop-blur-md');
    expect(c.querySelector('header img')!.className).not.toContain('invert');
  });
});

describe('cartões grandes nas vitrines', () => {
  const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
    id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment', listing_kind: 'resale',
    featured: true, cover_url: `https://cdn.x/${code}.jpg`, address: { city: 'Campinas' }, ...o,
  });
  const grade = (c: HTMLElement) => c.querySelector('#resultados .grid') as HTMLElement;

  it('grandes: duas colunas a partir do md, foto 3:2 e título de 24px na fonte dos títulos', async () => {
    const { container } = await abrirHome(comAp({ card_style: 'large' }), [imovel('A'), imovel('B')]);
    const g = grade(container);
    expect(g.className).toBe('grid grid-cols-1 gap-5 md:grid-cols-2');
    const art = g.querySelector('article')!;
    expect(art.querySelector('img')!.closest('a')).toHaveClass('aspect-[3/2]', 'min-h-[300px]');
    expect(within(art).getByRole('heading', { level: 3 })).toHaveClass('font-[var(--display)]', 'text-[24px]');
  });

  it('padrão: a grade e o cartão de sempre', async () => {
    const { container } = await abrirHome(comAp({ card_style: 'standard' }), [imovel('A')]);
    expect(grade(container).className).toBe('grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3');
    expect(grade(container).querySelector('img')!.closest('a')).toHaveClass('aspect-[4/3]');
  });
});
