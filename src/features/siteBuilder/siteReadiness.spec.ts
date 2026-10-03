import { describe, it, expect } from 'vitest';
import { siteReadiness } from './siteReadiness';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

const vazio = { branding: {}, contact: {}, tracking: {}, social_links: {}, watermark: { enabled: false } } as unknown as Site;

describe('siteReadiness', () => {
  it('site cru: 0%', () => {
    expect(siteReadiness(vazio, 0).percent).toBe(0);
  });

  it('cada item conta 1/5; 100% sem marca d\'água; endereço próprio não conta', () => {
    const site = { ...vazio, branding: { logo_url: 'x' }, contact: { whatsapp: '11' },
      tracking: { ga4_measurement_id: 'G-1' }, social_links: { instagram: 'u' },
      primary_domain: 'imob.com.br' } as unknown as Site;
    const r = siteReadiness(site, 3);
    expect(r.percent).toBe(100);
    expect(r.itens.find(i => i.id === 'endereco')).toMatchObject({ feito: true, conta: false });
    expect(siteReadiness({ ...vazio, branding: { logo_url: 'x' } } as unknown as Site, 0).percent).toBe(20);
  });

  it('marca d\'água aparece como sugestão mas não conta (até a faxina do disco)', () => {
    const marca = siteReadiness(vazio, 0).itens.find(i => i.id === 'marca');
    expect(marca).toMatchObject({ conta: false, tela: 'marca' });
    const comMarca = { ...vazio, watermark: { enabled: true, logo_url: 'l' } } as unknown as Site;
    expect(siteReadiness(comMarca, 0).percent).toBe(0);
  });

  it('marca ligada sem logo não conta como feita', () => {
    const site = { ...vazio, watermark: { enabled: true, logo_url: null } } as unknown as Site;
    expect(siteReadiness(site, 0).itens.find(i => i.id === 'marca')?.feito).toBe(false);
  });
});
