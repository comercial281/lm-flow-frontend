import { describe, expect, it } from 'vitest';
import type { Site, SiteFinancingPage, SiteListingPage } from '@/services/siteBuilder/siteBuilderService';
import {
  FINANCING_FALLBACK,
  LISTING_FALLBACK,
  emailDeliveryLabel,
  financingFrom,
  financingPayload,
  financingWarning,
  listingFrom,
  listingPayload,
  listingWarning,
  parseEmails,
} from './portalPages';

const site = (extra: Partial<Site>) => extra as Site;

describe('financingFrom', () => {
  it('cai nos cinco bancos de reserva contra servidor antigo — bloco vazio parece quebrado', () => {
    const page = financingFrom(site({}));
    expect(page.banks.map(b => b.key)).toEqual(['itau', 'santander', 'bb', 'bradesco', 'caixa']);
    expect(page.enabled).toBe(false);
  });

  it('os bancos de reserva já vêm com o simulador oficial', () => {
    const page = financingFrom(site({}));
    expect(page.banks.every(b => (b.url ?? '').startsWith('https://'))).toBe(true);
    expect(page.banks.find(b => b.key === 'caixa')?.url).toContain('caixa.gov.br');
  });

  it('usa o que o servidor resolveu quando ele responde', () => {
    const page = financingFrom(site({
      financiamento: {
        enabled: true, title: 'Financie com a gente', intro: 'i', footer: 'f',
        banks: [{ key: 'caixa', name: 'Caixa', color: '#0070AF', enabled: true, url: 'https://x' }],
      },
    }));
    expect(page.title).toBe('Financie com a gente');
    expect(page.banks).toHaveLength(1);
  });
});

describe('listingFrom', () => {
  it('nasce desligado e sem e-mail', () => {
    const page = listingFrom(site({}));
    expect(page.enabled).toBe(false);
    expect(page.emails).toEqual([]);
  });
});

describe('financingPayload', () => {
  const base = (): SiteFinancingPage => ({ ...FINANCING_FALLBACK, banks: FINANCING_FALLBACK.banks.map(b => ({ ...b })) });

  it('não manda texto igual ao de fábrica — senão a tela mostraria "escrito por mim"', () => {
    const out = financingPayload({ ...base(), enabled: true });
    expect(out.title).toBeUndefined();
    expect(out.intro).toBeUndefined();
    expect(out.enabled).toBe(true);
  });

  it('manda o texto reescrito', () => {
    const out = financingPayload({ ...base(), intro: '  Simule agora:  ' });
    expect(out.intro).toBe('Simule agora:');
  });

  it('manda os cinco bancos, e o link do gestor por cima do oficial', () => {
    const page = base();
    page.banks[0].url = ' https://parceiro.example/itau ';
    const out = financingPayload(page);
    expect(Object.keys(out.banks ?? {})).toHaveLength(5);
    expect(out.banks?.itau.url).toBe('https://parceiro.example/itau');
  });

  it('não manda link igual ao oficial — senão a página congela no endereço de hoje', () => {
    const out = financingPayload(base());
    expect(out.banks?.caixa.url).toBe('');
    expect(out.banks?.itau.url).toBe('');
  });
});

describe('listingPayload', () => {
  const base = (): SiteListingPage => ({ ...LISTING_FALLBACK, emails: [] });

  it('limpa e deduplica os e-mails, descartando o que não é e-mail', () => {
    const out = listingPayload({ ...base(), emails: ['Dono@Imob.com', 'lixo', 'dono@imob.com', 'ger@imob.com'] });
    expect(out.emails).toEqual(['dono@imob.com', 'ger@imob.com']);
  });

  it('não manda texto igual ao de fábrica', () => {
    expect(listingPayload({ ...base(), enabled: true }).thanks_title).toBeUndefined();
  });
});

describe('parseEmails', () => {
  it('aceita texto com vírgula, ponto e vírgula e quebra de linha', () => {
    expect(parseEmails('a@x.com; b@x.com\nc@x.com')).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('tem teto de cinco', () => {
    expect(parseEmails(Array.from({ length: 9 }, (_, i) => `a${i}@x.com`))).toHaveLength(5);
  });
});

describe('avisos da tela', () => {
  it('não avisa nada com os cinco bancos ligados — todos já têm o link oficial', () => {
    const page: SiteFinancingPage = { ...FINANCING_FALLBACK, enabled: true, banks: FINANCING_FALLBACK.banks.map(b => ({ ...b })) };
    expect(financingWarning(page)).toBeNull();
  });

  it('avisa quando todos os bancos foram desligados', () => {
    const banks = FINANCING_FALLBACK.banks.map(b => ({ ...b, enabled: false }));
    expect(financingWarning({ ...FINANCING_FALLBACK, enabled: true, banks })).toMatch(/vazia/);
  });

  it('avisa quantos bancos ficam de fora por estarem desligados', () => {
    const banks = FINANCING_FALLBACK.banks.map((b, i) => ({ ...b, enabled: i === 0 }));
    expect(financingWarning({ ...FINANCING_FALLBACK, enabled: true, banks })).toMatch(/4 banco/);
  });

  it('não avisa nada com a página desligada', () => {
    expect(financingWarning({ ...FINANCING_FALLBACK, banks: [] })).toBeNull();
    expect(listingWarning({ ...LISTING_FALLBACK, emails: [] })).toBeNull();
  });

  it('avisa que a ficha não chega a ninguém sem e-mail de destino', () => {
    expect(listingWarning({ ...LISTING_FALLBACK, enabled: true, emails: [] })).toMatch(/Cadastre ao menos um e-mail/);
  });
});

describe('emailDeliveryLabel', () => {
  it('traduz os desfechos que o servidor grava', () => {
    expect(emailDeliveryLabel('enviado')?.tone).toBe('ok');
    expect(emailDeliveryLabel('sem_email_configurado')?.tone).toBe('bad');
    expect(emailDeliveryLabel('falhou: conexão recusada')?.text).toBe('Não saiu — conexão recusada');
    expect(emailDeliveryLabel(null)).toBeNull();
  });
});
