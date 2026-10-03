// src/features/siteBuilder/public/siteTracking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isOwnDomain, installSiteTracking, trackLead } from './siteTracking';

function fakeWin() {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const w = window as unknown as Window & { dataLayer?: unknown[]; fbq?: unknown; __lmfTracking?: boolean };
  delete w.dataLayer; delete w.fbq; delete w.__lmfTracking;
  return w;
}

describe('isOwnDomain', () => {
  it.each([
    ['horizonte.lmflow.com.br', false], ['app.lmflow.com.br', false], ['lmflow.com.br', false],
    ['x.vercel.app', false], ['localhost', false], ['127.0.0.1', false],
    ['www.horizonteimoveis.com.br', true], ['horizonteimoveis.com.br', true],
  ])('%s → %s', (host, esperado) => expect(isOwnDomain(host)).toBe(esperado));
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

  it('em domínio próprio: GTM e códigos avançados entram', () => {
    installSiteTracking({ tracking: { gtm_id: 'GTM-XYZ1' }, custom_code: { head: '<meta name="lmf-teste" content="1">', body: null } },
      { host: 'www.imob.com.br' });
    expect(Array.from(document.querySelectorAll('script')).some(s => (s.getAttribute('src') ?? '').includes('gtm.js?id=GTM-XYZ1'))).toBe(true);
    expect(document.head.querySelector('meta[name="lmf-teste"]')).not.toBeNull();
  });

  it('não instala duas vezes', () => {
    const cfg = { tracking: { ga4: 'G-AB12' } };
    installSiteTracking(cfg, { host: 'imob.lmflow.com.br' });
    installSiteTracking(cfg, { host: 'imob.lmflow.com.br' });
    expect(document.querySelectorAll('script[src*="gtag/js"]').length).toBe(1);
  });

  it('trackLead sem nada instalado não quebra', () => {
    expect(() => trackLead()).not.toThrow();
  });
});
