import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalFooter, type SiteInfo } from '../portalShared';
import { APARENCIA_FABRICA, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';

/* Rodapé do Moderno (spec 7, "Rodapé"): bloco arredondado na cor principal,
   logo (clara se houver), frase com destaque, redes, colunas e crédito com
   CRECI. Compacto = uma linha. Clássico e manutenção não mudam. */

const LOGO = 'https://cdn.x/logo.png';
const LOGO_CLARA = 'https://cdn.x/logo-clara.png';

const base: SiteInfo = {
  name: 'Imob Teste',
  branding: { logo_url: LOGO, primary_color: '#1E3A8A', accent_color: '#F59E0B' },
  contact: { phone: '(11) 3333-4444', email: 'contato@imob.com.br', whatsapp: '5511999990000' },
  social_links: { instagram: 'https://instagram.com/imob' },
  creci: 'J-34.512',
};
const moderno = (ap: Partial<Aparencia> = {}, extra: Partial<SiteInfo> = {}): SiteInfo => ({
  ...base, ...extra, appearance: { ...APARENCIA_FABRICA, style: 'modern', ...ap },
});

async function rodape(site: SiteInfo) {
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<MemoryRouter><PortalFooter site={site} tenant="imob" /></MemoryRouter>); });
  return out.container;
}
const raiz = (c: HTMLElement) => c.querySelector<HTMLElement>('footer[data-estilo="moderno"]');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RodapeModerno', () => {
  it('bloco na cor principal com a frase em destaque (accent) e sem asteriscos soltos', async () => {
    const c = await rodape(moderno({ footer_text: 'Seu lar *de verdade*', heading_highlight: 'accent' }));
    expect(raiz(c)!.getAttribute('style')).toContain('var(--brand)');
    const span = raiz(c)!.querySelector('span[data-destaque="accent"]')!;
    expect(span).toHaveTextContent('de verdade');
    expect(span.hasAttribute('data-sobre-escuro')).toBe(true);
    expect(raiz(c)!.textContent).not.toContain('*');
  });

  it('destaque em itálico e modo none (sem span)', async () => {
    const it1 = await rodape(moderno({ footer_text: 'Seu lar *de verdade*', heading_highlight: 'italic' }));
    expect(raiz(it1)!.querySelector('span[data-destaque="italic"]')).toBeTruthy();
    cleanup();
    const none = await rodape(moderno({ footer_text: 'Seu lar *de verdade*', heading_highlight: 'none' }));
    expect(raiz(none)!.querySelector('[data-destaque]')).toBeNull();
  });

  it('logo clara quando existe; colunas, redes, WhatsApp e crédito com CRECI', async () => {
    const c = await rodape(moderno({ logo_light_url: LOGO_CLARA }));
    expect(raiz(c)!.querySelector(`img[src="${LOGO_CLARA}"]`)).toBeTruthy();
    expect(raiz(c)!.querySelector('nav[aria-label="Links do rodapé"]')).toBeTruthy();
    expect(raiz(c)!.querySelector('a[href="https://instagram.com/imob"]')).toBeTruthy();
    expect(raiz(c)!.querySelector('a[href^="tel:"]')).toHaveTextContent('(11) 3333-4444');
    expect(raiz(c)!.querySelector('a[href^="mailto:"]')).toHaveTextContent('contato@imob.com.br');
    expect(raiz(c)!.textContent).toContain('J-34.512');
    expect(raiz(c)!.textContent).toContain('LM Flow');
  });

  it('compacto: sem as colunas, com a frase e o crédito', async () => {
    const c = await rodape(moderno({ footer_layout: 'compact' }));
    expect(raiz(c)!.querySelector('nav[aria-label="Links do rodapé"]')).toBeNull();
    expect(raiz(c)!.querySelector('a[href^="tel:"]')).toBeNull();
    expect(raiz(c)!.textContent).toContain('Seu portal de imóveis');
    expect(raiz(c)!.textContent).toContain('J-34.512');
  });

  it('Clássico e manutenção: sem o rodapé do Moderno', async () => {
    expect(raiz(await rodape({ ...base, appearance: { ...APARENCIA_FABRICA } }))).toBeNull();
    cleanup();
    expect(raiz(await rodape(moderno({}, { maintenance: true })))).toBeNull();
  });
});
