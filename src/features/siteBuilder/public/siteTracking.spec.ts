// src/features/siteBuilder/public/siteTracking.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isOwnDomain, installSiteTracking, trackLead, trackPageView } from './siteTracking';
import { dominioDoSite, esquecerDominio } from './dominioDoSite';

function fakeWin() {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const w = window as unknown as Window & { dataLayer?: unknown[]; fbq?: unknown; __lmfTracking?: boolean };
  delete w.dataLayer; delete w.fbq; delete (w as { gtag?: unknown }).gtag; delete w.__lmfTracking;
  return w;
}

/** Confirma o domínio como faria o middleware (window.__LMF_SITE__). */
async function confirmar(host: string) {
  await dominioDoSite({ win: { location: { hostname: host }, __LMF_SITE__: { tenant: 'imob', slug: 'imob' } } });
}

afterEach(() => { esquecerDominio(); });

describe('isOwnDomain', () => {
  it.each([
    'horizonte.lmflow.com.br', 'app.lmflow.com.br', 'lmflow.com.br', 'x.vercel.app', 'localhost', '127.0.0.1',
    'www.horizonteimoveis.com.br', 'horizonteimoveis.com.br', 'evil-lmflow.com.br', '[::1]', '192.168.0.10',
  ])('sem domínio confirmado, %s não é domínio próprio', host => expect(isOwnDomain(host)).toBe(false));

  it('só o host confirmado por dominioDoSite é domínio próprio (lista positiva)', async () => {
    await confirmar('www.horizonteimoveis.com.br');
    expect(isOwnDomain('www.horizonteimoveis.com.br')).toBe(true);
    expect(isOwnDomain('WWW.horizonteimoveis.com.br.')).toBe(true);
    expect(isOwnDomain('horizonteimoveis.com.br')).toBe(false);
    expect(isOwnDomain('outro.com.br')).toBe(false);
    expect(isOwnDomain('horizonte.lmflow.com.br')).toBe(false);
  });

  it('domínio que o servidor recusou (404) não é domínio próprio', async () => {
    await dominioDoSite({ win: { location: { hostname: 'www.removido.com.br' } }, api: 'https://api.x',
      fetchFn: vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response) });
    expect(isOwnDomain('www.removido.com.br')).toBe(false);
  });
});

describe('installSiteTracking', () => {
  beforeEach(() => { fakeWin(); });

  it('no endereço lmflow: GA4 e Pixel sim; GTM e códigos avançados NÃO', () => {
    installSiteTracking({ tracking: { ga4: 'G-AB12', facebook_pixel: '123456', gtm_id: 'GTM-XYZ1' },
      custom_code: { head: '<script>window.__mal=1</script>', body: null } }, { host: 'imob.lmflow.com.br' });
    const srcs = Array.from(document.querySelectorAll('script')).map(s => s.getAttribute('src') ?? s.textContent);
    expect(srcs.some(s => s?.includes('gtag/js?id=G-AB12'))).toBe(true);
    expect(srcs.some(s => s?.includes('googletagmanager.com/gtm.js'))).toBe(false);
    expect((window as unknown as { __mal?: number }).__mal).toBeUndefined();
    expect(typeof (window as unknown as { fbq?: unknown }).fbq).toBe('function');
  });

  it('domínio que não foi confirmado: GTM e códigos avançados NÃO entram', () => {
    installSiteTracking({ tracking: { gtm_id: 'GTM-XYZ1' }, custom_code: { head: '<meta name="lmf-teste" content="1">', body: null } },
      { host: 'www.imob.com.br' });
    expect(document.querySelectorAll('script[src*="gtm.js"]').length).toBe(0);
    expect(document.head.querySelector('meta[name="lmf-teste"]')).toBeNull();
  });

  it('em domínio próprio confirmado: GTM e códigos avançados entram', async () => {
    await confirmar('www.imob.com.br');
    installSiteTracking({ tracking: { gtm_id: 'GTM-XYZ1' }, custom_code: { head: '<meta name="lmf-teste" content="1">', body: null } },
      { host: 'www.imob.com.br' });
    expect(Array.from(document.querySelectorAll('script')).some(s => (s.getAttribute('src') ?? '').includes('gtm.js?id=GTM-XYZ1'))).toBe(true);
    expect(document.head.querySelector('meta[name="lmf-teste"]')).not.toBeNull();
  });

  it('id fora do formato (valor antigo) não carrega nada: GTM no campo do GA4 num endereço lmflow', () => {
    installSiteTracking({ tracking: { ga4: 'GTM-XXX', facebook_pixel: 'abc<script>' } }, { host: 'imob.lmflow.com.br' });
    expect(document.querySelectorAll('script').length).toBe(0);
    expect((window as unknown as { dataLayer?: unknown }).dataLayer).toBeUndefined();
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
    // Não travou: uma config válida depois ainda instala.
    installSiteTracking({ tracking: { ga4: 'G-AB12' } }, { host: 'imob.lmflow.com.br' });
    expect(document.querySelectorAll('script[src*="gtag/js"]').length).toBe(1);
  });

  it('GTM fora do formato não carrega nem em domínio próprio', async () => {
    await confirmar('www.imob.com.br');
    installSiteTracking({ tracking: { gtm_id: 'G-AB12' } }, { host: 'www.imob.com.br' });
    expect(document.querySelectorAll('script[src*="gtm.js"]').length).toBe(0);
  });

  it('não instala duas vezes', () => {
    const cfg = { tracking: { ga4: 'G-AB12' } };
    installSiteTracking(cfg, { host: 'imob.lmflow.com.br' });
    installSiteTracking(cfg, { host: 'imob.lmflow.com.br' });
    expect(document.querySelectorAll('script[src*="gtag/js"]').length).toBe(1);
  });

  it('gtag empurra Arguments e o config leva o id do GA4', () => {
    installSiteTracking({ tracking: { ga4: 'G-AB12' } }, { host: 'imob.lmflow.com.br' });
    const dl = (window as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(Object.prototype.toString.call(dl[0])).toBe('[object Arguments]');
    const cfg = dl.find(e => (e as ArrayLike<unknown>)[0] === 'config') as ArrayLike<unknown>;
    expect(cfg[1]).toBe('G-AB12');
  });

  it('config vazia não trava a instalação seguinte', () => {
    installSiteTracking({}, { host: 'imob.lmflow.com.br' });
    installSiteTracking({ tracking: { ga4: 'G-AB12' } }, { host: 'imob.lmflow.com.br' });
    expect(document.querySelectorAll('script[src*="gtag/js"]').length).toBe(1);
  });

  it('trackPageView chama gtag e fbq; sem eles não quebra', () => {
    expect(() => trackPageView('/x')).not.toThrow();
    const w = window as unknown as { gtag?: unknown; fbq?: unknown };
    const gtag = vi.fn(); const fbq = vi.fn();
    w.gtag = gtag; w.fbq = fbq;
    trackPageView('/x');
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ page_path: '/x' }));
    expect(fbq).toHaveBeenCalledWith('track', 'PageView');
    delete w.gtag; delete w.fbq;
  });

  it('trackLead sem nada instalado não quebra', () => {
    expect(() => trackLead()).not.toThrow();
  });
});
