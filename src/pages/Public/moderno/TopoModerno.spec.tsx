import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalHeader, type SiteInfo } from '../portalShared';
import { APARENCIA_FABRICA, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';

/* ────────────────────────────────────────────────────────────────────────────
   Topo do Moderno (spec 7, "Topo"): no Início com topo transparente e capa
   sobre a foto, o menu flutua em pílula de vidro por cima do cartão da capa e,
   ao rolar, vira a barra sólida arredondada grudada no alto. Nas outras
   páginas (e com capa dividida ou topo branco) é a barra sólida branca; com o
   topo na cor principal, a barra na cor principal. O logo aparece sempre fora
   do Início. No Clássico, nada muda.
──────────────────────────────────────────────────────────────────────────── */

const LOGO = 'https://cdn.x/logo.png';

const base: SiteInfo = {
  name: 'Imob Teste',
  branding: { logo_url: LOGO, primary_color: '#1E3A8A', accent_color: '#F59E0B' },
  contact: { phone: '(11) 3333-4444', email: 'contato@imob.com.br', whatsapp: '5511999990000' },
  social_links: { instagram: 'https://instagram.com/imob' },
};
const moderno = (ap: Partial<Aparencia> = {}, extra: Partial<SiteInfo> = {}): SiteInfo => ({
  ...base, ...extra, appearance: { ...APARENCIA_FABRICA, style: 'modern', ...ap },
});

const rolar = (px: number) => {
  Object.defineProperty(window, 'scrollY', { value: px, writable: true, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
};

async function topo(site: SiteInfo, onHome = false) {
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<MemoryRouter><PortalHeader site={site} tenant="imob" onHome={onHome} /></MemoryRouter>); });
  return out.container;
}
const raiz = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-estilo="moderno"]');
const logosNoTopo = (c: HTMLElement) => [...raiz(c)!.querySelectorAll('img')].filter(i => i.getAttribute('src') === LOGO);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) }));
  rolar(0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('TopoModerno', () => {
  it('(a) fora do Início, com o logo em destaque na capa, o logo aparece no topo', async () => {
    const c = await topo(moderno({ logo_position: 'hero' }));
    const [img] = logosNoTopo(c);
    expect(img).toBeTruthy();
    expect(img.className).not.toContain('opacity-0');
    expect(img.closest('a')!.getAttribute('aria-hidden')).toBeNull();
  });

  it('(b) Início com topo transparente: flutua sobre a capa antes de rolar e vira barra sólida ao rolar', async () => {
    const c = await topo(moderno(), true);
    expect(raiz(c)!.getAttribute('data-flutuando')).toBe('sim');
    expect(raiz(c)!.className).toContain('fixed');
    rolar(400);
    expect(raiz(c)!.getAttribute('data-flutuando')).toBe('nao');
    expect(raiz(c)!.className).toContain('fixed');
  });

  it('(b) fora do Início, com capa dividida ou topo branco, não flutua', async () => {
    expect(raiz(await topo(moderno()))!.getAttribute('data-flutuando')).toBe('nao');
    cleanup();
    expect(raiz(await topo(moderno({ hero_layout: 'split' }), true))!.getAttribute('data-flutuando')).toBe('nao');
    cleanup();
    expect(raiz(await topo(moderno({ header_style: 'white' }), true))!.getAttribute('data-flutuando')).toBe('nao');
  });

  it('(c) topo na cor principal: a barra é da cor principal', async () => {
    const c = await topo(moderno({ header_style: 'brand' }));
    expect(raiz(c)!.querySelector('header')!.getAttribute('style')).toContain('var(--brand)');
  });

  it('(d) site Clássico e site em manutenção: sem o topo do Moderno', async () => {
    const classico = await topo({ ...base, appearance: { ...APARENCIA_FABRICA } }, true);
    expect(raiz(classico)).toBeNull();
    cleanup();
    expect(raiz(await topo(moderno({}, { maintenance: true })))).toBeNull();
  });

  it('(e) fundo escuro + topo branco + capa dividida + logo em destaque: exatamente um logo no topo', async () => {
    const ap: Partial<Aparencia> = { background: 'dark', header_style: 'white', hero_layout: 'split', logo_position: 'hero' };
    expect(logosNoTopo(await topo(moderno(ap), true))).toHaveLength(1);
    cleanup();
    expect(logosNoTopo(await topo(moderno(ap)))).toHaveLength(1);
  });

  it('faixa de cima nas internas, fora do bloco que gruda', async () => {
    const c = await topo(moderno());
    const tel = c.querySelector('a[href^="tel:"]')!;
    expect(tel).toHaveTextContent('(11) 3333-4444');
    expect(raiz(c)!.contains(tel)).toBe(false);
  });

  it('celular: o sanduíche abre o menu com os contatos e o Escape fecha', async () => {
    const c = await topo(moderno());
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = c.querySelector('#menu-do-celular')!;
    expect(menu).toBeTruthy();
    expect(menu.querySelector('a[href^="mailto:"]')).toHaveTextContent('contato@imob.com.br');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(c.querySelector('#menu-do-celular')).toBeNull();
  });
});
