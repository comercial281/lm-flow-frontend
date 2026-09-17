import { describe, expect, it } from 'vitest';
import { LANDING_DATA_MARKER, injectLandingIntoHtml, jsonForScript, lcpImageUrl } from './landingHtml';
import type { PublicLandingDTO } from './landingLoader';

const html = `<html><head>\n    ${LANDING_DATA_MARKER}\n    <title>Carregando…</title></head><body></body></html>`;

const dto = (over: Partial<PublicLandingDTO> = {}): PublicLandingDTO => ({
  title: 'More no Jardim',
  content_blocks: [{ type: 'hero', visible: true, config: {} }],
  property: {
    code: 'X', title: 'Vibra',
    photos: [
      { file_url: 'https://cdn/1.jpg', hero_url: 'https://cdn/1-hero.jpg' },
      { file_url: 'https://cdn/2.jpg', hero_url: 'https://cdn/2-hero.jpg', is_cover: true },
    ],
  },
  ...over,
});

describe('lcpImageUrl', () => {
  it('capa marcada, na versão redimensionada — a mesma regra do bloco na tela', () => {
    expect(lcpImageUrl(dto())).toBe('https://cdn/2-hero.jpg');
  });

  it('sem versão redimensionada cai na original; sem capa marcada vale a primeira', () => {
    const d = dto({ property: { code: 'X', title: 'V', photos: [{ file_url: 'https://cdn/a.jpg' }] } });
    expect(lcpImageUrl(d)).toBe('https://cdn/a.jpg');
  });

  it('imagem escolhida no editor vence a foto do imóvel', () => {
    const d = dto({ content_blocks: [{ type: 'hero', config: { imageUrl: 'https://cdn/escolhida.jpg' } }] });
    expect(lcpImageUrl(d)).toBe('https://cdn/escolhida.jpg');
  });

  it('bloco de capa escondido não conta; sem capa, nada é pré-carregado', () => {
    expect(lcpImageUrl(dto({ content_blocks: [{ type: 'hero', visible: false, config: {} }] }))).toBeNull();
    expect(lcpImageUrl(dto({ content_blocks: [{ type: 'price_band', config: {} }] }))).toBeNull();
    expect(lcpImageUrl(dto({ property: null }))).toBeNull();
  });
});

describe('injectLandingIntoHtml', () => {
  it('costura o preload da capa, os dados e o título no lugar do marcador', () => {
    const out = injectLandingIntoHtml(html, { tenant: 'apto', slug: 'lp-x', dto: dto() });
    expect(out).not.toContain(LANDING_DATA_MARKER);
    expect(out).toContain('<link rel="preload" as="image" href="https://cdn/2-hero.jpg" fetchpriority="high" />');
    expect(out).toContain('<script>window.__lmLanding={"tenant":"apto","slug":"lp-x","data":{');
    expect(out).toContain('<title>More no Jardim</title>');
    expect(out).not.toContain('Carregando…');
  });

  it('sem o marcador o HTML volta intacto (a página busca sozinha)', () => {
    const plain = '<html><head><title>Carregando…</title></head></html>';
    expect(injectLandingIntoHtml(plain, { tenant: 't', slug: 's', dto: dto() })).toBe(plain);
  });

  it('texto da landing não vira marcação: </script> e aspas são escapados', () => {
    const d = dto({ title: 'Oferta "x" <b>' });
    d.content_blocks = [{ type: 'text', config: { html: '</script><script>alert(1)</script>' } }];
    const out = injectLandingIntoHtml(html, { tenant: 't', slug: 's', dto: d });
    expect(out).toContain('<title>Oferta &quot;x&quot; &lt;b&gt;</title>');
    expect(out).not.toContain('</script><script>alert');
    expect(out).toContain('\\u003c/script\\u003e');
    // O JSON continua válido depois do escape.
    const m = out.match(/window\.__lmLanding=(.*?)<\/script>/);
    expect(JSON.parse(m![1]).data.content_blocks[0].config.html).toBe('</script><script>alert(1)</script>');
  });
});

describe('jsonForScript', () => {
  it('escapa os caracteres que o HTML interpretaria dentro de <script>', () => {
    expect(jsonForScript({ a: '<x>&' })).toBe('{"a":"\\u003cx\\u003e\\u0026"}');
  });
});
