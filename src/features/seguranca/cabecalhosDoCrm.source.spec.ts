import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Cabeçalhos de segurança das telas do CRM (auditoria 3E-06, 12/11/2026).
// Lê o vercel.json de verdade: a regra vale só nos endereços lmflow e nunca nas
// páginas que podem ser embutidas em site de terceiro (landing, portal, imóvel, widget).
type Regra = { source: string; has?: { type: string; value: string }[]; headers: { key: string; value: string }[] };
const config = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')) as { headers: Regra[] };
const regra = config.headers.find((r) => r.headers.some((h) => h.key === 'X-Frame-Options'));
const cabecalho = (k: string) => regra?.headers.find((h) => h.key === k)?.value ?? '';
// O `source` do Vercel é path-to-regexp; o grupo com lookahead vale como regex inteira.
const casa = (caminho: string) => new RegExp(`^${regra!.source}$`).test(caminho);

describe('cabeçalhos de segurança do CRM', () => {
  it('existe e vale só nos endereços lmflow', () => {
    expect(regra).toBeDefined();
    const host = regra!.has?.find((h) => h.type === 'host')?.value ?? '';
    const r = new RegExp(`^${host}$`);
    expect(r.test('app.lmflow.com.br')).toBe(true);
    expect(r.test('baronesimoveis.lmflow.com.br')).toBe(true);
    expect(r.test('www.imobiliaria.com.br')).toBe(false);
    expect(r.test('lmflow.com.br.golpe.io')).toBe(false);
  });

  it('as telas do CRM não abrem dentro de iframe de outro site', () => {
    for (const p of ['/', '/login', '/conversations/12', '/settings/site-builder', '/sso']) expect(casa(p)).toBe(true);
    expect(cabecalho('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(cabecalho('Content-Security-Policy')).toBe("frame-ancestors 'self'");
  });

  it('landing, portal, imóvel público, widget e arquivos ficam livres', () => {
    for (const p of ['/lp/imob/oferta', '/lp.html', '/portal/imob', '/portal/imob/imoveis', '/imovel/imob/AP01', '/widget', '/widget?x=1', '/assets/app.js']) {
      expect(casa(p)).toBe(false);
    }
  });

  it('a CSP completa só observa (Report-Only) e não libera script em linha nem eval', () => {
    const csp = cabecalho('Content-Security-Policy-Report-Only');
    const script = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(script).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
  });
});
