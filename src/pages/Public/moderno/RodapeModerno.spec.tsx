import { cleanup, render, within } from '@testing-library/react';
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

  it('título de coluna e destaque do rodapé usam --m-accent-on-brand (o destaque cru some quando é igual à marca)', async () => {
    const c = await rodape(moderno({ footer_text: 'Seu lar *de verdade*', heading_highlight: 'accent' }));
    expect(raiz(c)!.querySelector('h4')!.className).toContain('text-[var(--m-accent-on-brand)]');
    expect(raiz(c)!.querySelector('h4')!.className).not.toContain('text-[var(--accent)]');
    expect(raiz(c)!.querySelector('[data-destaque="accent"]')!.closest('p')!.className).toContain('var(--m-accent-on-brand)');
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
    const ig = within(raiz(c)!).getByRole('link', { name: 'Instagram' });
    expect(ig.getAttribute('href')).toBe('https://instagram.com/imob');
    expect(ig.getAttribute('title')).toBe('Instagram');
    expect(ig.querySelector('svg')).toBeTruthy();
    expect(raiz(c)!.querySelector('a[href^="tel:"]')).toHaveTextContent('(11) 3333-4444');
    expect(raiz(c)!.querySelector('a[href^="mailto:"]')).toHaveTextContent('contato@imob.com.br');
    expect(raiz(c)!.textContent).toContain('J-34.512');
    expect(raiz(c)!.textContent).toContain('LM Flow');
  });

  it('compacto: os links na mesma faixa, sem o layout de colunas, com a frase e o crédito', async () => {
    const c = await rodape(moderno({ footer_layout: 'compact' }));
    expect(raiz(c)!.getAttribute('data-rodape')).toBe('compact');
    const nav = raiz(c)!.querySelector('nav[aria-label="Links do rodapé"]')!;
    expect(nav.querySelectorAll('a').length).toBeGreaterThan(0);
    expect(raiz(c)!.querySelector('.grid')).toBeNull();
    expect(raiz(c)!.querySelector('h4')).toBeNull();
    expect(raiz(c)!.textContent).toContain('Seu portal de imóveis');
    expect(raiz(c)!.textContent).toContain('J-34.512');
  });

  it('logo pela cor principal: clara sobre cor escura, normal sobre cor clara', async () => {
    const escura = await rodape(moderno({ logo_light_url: LOGO_CLARA }));
    expect(raiz(escura)!.querySelector(`img[src="${LOGO_CLARA}"]`)).toBeTruthy();
    cleanup();
    const clara = await rodape(moderno({ logo_light_url: LOGO_CLARA }, { branding: { logo_url: LOGO, primary_color: '#FDE899', accent_color: '#F59E0B' } }));
    expect(raiz(clara)!.querySelector(`img[src="${LOGO}"]`)).toBeTruthy();
    expect(raiz(clara)!.querySelector(`img[src="${LOGO_CLARA}"]`)).toBeNull();
    // o texto do bloco segue a cor sobre a principal, não branco fixo
    expect(raiz(clara)!.getAttribute('style')).toContain('color: var(--brand-ink)');
    expect(raiz(clara)!.querySelector('p')!.className).not.toContain('text-white');
  });

  it('sem endereço, WhatsApp, telefone nem e-mail: sem a coluna Atendimento vazia', async () => {
    const c = await rodape(moderno({}, { contact: { whatsapp: '', phone: '', email: '', address: '' } }));
    expect(within(raiz(c)!).queryByText('Atendimento')).toBeNull();
    cleanup();
    const comTelefone = await rodape(moderno({}, { contact: { phone: '(11) 3333-4444' } }));
    expect(within(raiz(comTelefone)!).getByText('Atendimento')).toBeInTheDocument();
  });

  it('Clássico e manutenção: sem o rodapé do Moderno', async () => {
    expect(raiz(await rodape({ ...base, appearance: { ...APARENCIA_FABRICA } }))).toBeNull();
    cleanup();
    expect(raiz(await rodape(moderno({}, { maintenance: true })))).toBeNull();
  });
});
