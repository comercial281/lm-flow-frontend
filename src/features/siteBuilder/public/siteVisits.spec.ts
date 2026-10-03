// src/features/siteBuilder/public/siteVisits.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { getVisitorId, sessionSource, sendSiteVisit } from './siteVisits';

const mem = () => { const m = new Map<string, string>(); return {
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage; };
const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } } as unknown as Storage;

describe('siteVisits', () => {
  it('visitor id estável no mesmo navegador', () => {
    const s = mem();
    expect(getVisitorId(s)).toBe(getVisitorId(s));
  });

  it('storage que lança: id temporário, sem erro', () => {
    expect(() => getVisitorId(quebrado)).not.toThrow();
    expect(getVisitorId(quebrado)).toMatch(/.{8,}/);
    expect(() => sessionSource(quebrado, { search: '' }, '')).not.toThrow();
  });

  it('origem é a da 1ª tela da sessão', () => {
    const s = mem();
    const a = sessionSource(s, { search: '?utm_medium=cpc&utm_source=facebook&gclid=1' }, 'https://www.google.com/');
    const b = sessionSource(s, { search: '' }, 'https://imob.lmflow.com.br/portal/imob');
    expect(a).toMatchObject({ referrer: 'https://www.google.com/', utm_medium: 'cpc', gclid: true, entry: true });
    expect(b).toMatchObject({ referrer: 'https://www.google.com/', utm_medium: 'cpc', gclid: true, entry: false });
  });

  it('manda POST keepalive com X-Tenant e corpo { visit }', () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    sendSiteVisit({ kind: 'property', path: '/imovel/imob/AP1', propertyCode: 'AP1' },
      { api: 'https://api.x', tenant: 'imob', fetchFn, local: mem(), session: mem(), loc: { search: '' }, referrer: '' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.x/api/public/v1/site/visits');
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    expect((init.headers as Record<string, string>)['X-Tenant']).toBe('imob');
    expect(JSON.parse(init.body as string).visit).toMatchObject({ kind: 'property', property_code: 'AP1', entry: true });
  });

  it('falha de rede não sobe erro', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    expect(() => sendSiteVisit({ kind: 'home', path: '/' }, { api: 'a', tenant: 't', fetchFn, local: mem(), session: mem(), loc: { search: '' }, referrer: '' })).not.toThrow();
  });
});
