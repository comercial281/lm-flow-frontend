import { describe, it, expect } from 'vitest';
import { siteReadiness } from './siteReadiness';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

const vazio = { branding: {}, contact: {}, tracking: {}, social_links: {}, watermark: { enabled: false } } as unknown as Site;

describe('siteReadiness', () => {
  it('site cru: 0%', () => {
    expect(siteReadiness(vazio, 0).percent).toBe(0);
  });

  it('cada item conta 1/6; endereço próprio não conta', () => {
    const site = { ...vazio, branding: { logo_url: 'x' }, contact: { whatsapp: '11' },
      tracking: { ga4_measurement_id: 'G-1' }, social_links: { instagram: 'u' },
      watermark: { enabled: true, logo_url: 'l' }, primary_domain: 'imob.com.br' } as unknown as Site;
    const r = siteReadiness(site, 3);
    expect(r.percent).toBe(100);
    expect(r.itens.find(i => i.id === 'endereco')).toMatchObject({ feito: true, conta: false });
  });

  it('marca ligada sem logo não conta como feita', () => {
    const site = { ...vazio, watermark: { enabled: true, logo_url: null } } as unknown as Site;
    expect(siteReadiness(site, 0).itens.find(i => i.id === 'marca')?.feito).toBe(false);
  });
});
