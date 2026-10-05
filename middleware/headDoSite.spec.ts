import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import middleware from '../middleware';
import { montarHead, paginaDoSite, robotsTxt, sitemapXml, type DadosDoHead } from './headDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   O <head> do site, o robots.txt e o sitemap.xml montados na borda. O HTML é o
   index.html DE VERDADE do repositório: se alguém mudar uma tag dele, os
   testes de troca (título, descrição, robots, PWA) acusam.
──────────────────────────────────────────────────────────────────────────── */

const INDEX_HTML = readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const LP_HTML = readFileSync(path.resolve(__dirname, '../lp.html'), 'utf8');

const DOMINIO = 'www.imob.com.br';
const LMFLOW = 'app.lmflow.com.br';

const DADOS: DadosDoHead = {
  tenant: 'imob',
  site_slug: 'imob-site',
  domain: DOMINIO,
  title: 'Imob Teste · Imóveis em Campinas',
  description: 'Casas e apartamentos à venda em Campinas.',
  image: 'https://cdn.test/capa.jpg',
  url: `https://${DOMINIO}/`,
  canonical: `https://${DOMINIO}/`,
  robots: 'index,follow',
  maintenance: false,
};

const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const meta = (d: Document, sel: string) => d.querySelector(sel)?.getAttribute('content') ?? null;

describe('montarHead', () => {
  it('troca o título e a descrição do CRM pelos do site', () => {
    const d = doc(montarHead(INDEX_HTML, DADOS, DOMINIO));
    expect(d.title).toBe('Imob Teste · Imóveis em Campinas');
    expect(d.querySelectorAll('title')).toHaveLength(1);
    expect(d.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(meta(d, 'meta[name="description"]')).toBe('Casas e apartamentos à venda em Campinas.');
  });

  it('sem descrição do servidor, a do CRM sai (nunca descreve o site como CRM)', () => {
    const html = montarHead(INDEX_HTML, { ...DADOS, description: null }, DOMINIO);
    expect(html).not.toContain('CRM imobiliário');
    expect(doc(html).querySelector('meta[name="description"]')).toBeNull();
  });

  it('injeta og:title, og:description, og:image, og:url e og:type', () => {
    const d = doc(montarHead(INDEX_HTML, DADOS, DOMINIO));
    expect(meta(d, 'meta[property="og:title"]')).toBe(DADOS.title);
    expect(meta(d, 'meta[property="og:description"]')).toBe(DADOS.description);
    expect(meta(d, 'meta[property="og:image"]')).toBe('https://cdn.test/capa.jpg');
    expect(meta(d, 'meta[property="og:url"]')).toBe(`https://${DOMINIO}/`);
    expect(meta(d, 'meta[property="og:type"]')).toBe('website');
  });

  it('og:url cai no canonical quando o servidor não manda url', () => {
    const d = doc(montarHead(INDEX_HTML, { ...DADOS, url: null, canonical: 'https://www.imob.com.br/blog/a' }, DOMINIO));
    expect(meta(d, 'meta[property="og:url"]')).toBe('https://www.imob.com.br/blog/a');
  });

  it('twitter:card grande com foto, simples sem foto', () => {
    expect(meta(doc(montarHead(INDEX_HTML, DADOS, DOMINIO)), 'meta[name="twitter:card"]')).toBe('summary_large_image');
    const semFoto = doc(montarHead(INDEX_HTML, { ...DADOS, image: null }, DOMINIO));
    expect(meta(semFoto, 'meta[name="twitter:card"]')).toBe('summary');
    expect(semFoto.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it('link canonical', () => {
    const d = doc(montarHead(INDEX_HTML, { ...DADOS, canonical: 'https://www.imob.com.br/imovel/AP1' }, DOMINIO));
    expect(d.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.imob.com.br/imovel/AP1');
  });

  it('robots do servidor troca o noindex do index.html (uma tag só)', () => {
    const d = doc(montarHead(INDEX_HTML, DADOS, DOMINIO));
    expect(d.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(meta(d, 'meta[name="robots"]')).toBe('index,follow');
  });

  it.each([
    ['robots noindex do servidor', { robots: 'noindex' }],
    ['sem robots (servidor velho)', { robots: null }],
    ['robots com lixo', { robots: '"><script>x</script>' }],
    ['site em manutenção, mesmo com index', { robots: 'index,follow', maintenance: true }],
  ])('noindex: %s', (_nome, extra) => {
    const html = montarHead(INDEX_HTML, { ...DADOS, ...extra }, DOMINIO);
    const d = doc(html);
    expect(d.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(meta(d, 'meta[name="robots"]')).toBe('noindex');
    expect(html).not.toContain('<script>x</script>');
  });

  it('escapa "<>& no título e na descrição vindos do servidor', () => {
    const titulo = 'Casa "Top" <script>alert(1)</script> & cia';
    const html = montarHead(INDEX_HTML, { ...DADOS, title: titulo, description: '<b>"x"</b> & y', image: 'https://x.test/a.jpg?a=1&b="2"' }, DOMINIO);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('<title>Casa &quot;Top&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; cia</title>');
    expect(html).toContain('content="Casa &quot;Top&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; cia"');
    expect(html).toContain('content="&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y"');
    expect(html).toContain('content="https://x.test/a.jpg?a=1&amp;b=&quot;2&quot;"');
    const d = doc(html);
    expect(d.title).toBe(titulo);
    expect(meta(d, 'meta[property="og:title"]')).toBe(titulo);
  });

  it('no domínio ativo, põe o window.__LMF_SITE__ com o cliente e o site', () => {
    const html = montarHead(INDEX_HTML, DADOS, DOMINIO);
    expect(html).toContain('<script>window.__LMF_SITE__={"tenant":"imob","slug":"imob-site"}</script>');
    // Antes do </head>: o código do app (módulo, roda depois) já encontra o objeto.
    expect(html.indexOf('__LMF_SITE__')).toBeLessThan(html.indexOf('</head>'));
  });

  it('__LMF_SITE__ com </script> no meio não fecha a tag', () => {
    const html = montarHead(INDEX_HTML, { ...DADOS, site_slug: '</script><script>alert(1)' }, DOMINIO);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script\\u003e');
  });

  it.each([
    ['endereço lmflow', LMFLOW, DADOS],
    ['domínio diferente do que o servidor confirmou', 'imob.com.br', DADOS],
    ['site sem domínio ativo', DOMINIO, { ...DADOS, domain: null }],
  ])('sem __LMF_SITE__: %s', (_nome, host, dados) => {
    expect(montarHead(INDEX_HTML, dados, host)).not.toContain('__LMF_SITE__');
  });

  it('no domínio ativo tira o manifest e as metas do PWA (nada de "Instalar LM Flow")', () => {
    const d = doc(montarHead(INDEX_HTML, DADOS, DOMINIO));
    expect(d.querySelector('link[rel="manifest"]')).toBeNull();
    expect(d.querySelector('meta[name^="apple-mobile-web-app-"]')).toBeNull();
    expect(d.querySelector('meta[name="application-name"]')).toBeNull();
  });

  it('no endereço lmflow o manifest fica (é o app de sempre)', () => {
    const d = doc(montarHead(INDEX_HTML, DADOS, LMFLOW));
    expect(d.querySelector('link[rel="manifest"]')).not.toBeNull();
  });

  it('HTML sem </head> volta como veio', () => {
    expect(montarHead('<html>oi', DADOS, DOMINIO)).toBe('<html>oi');
  });
});

describe('paginaDoSite', () => {
  it.each([
    ['/portal/imob', { tenant: 'imob', path: '/' }],
    ['/portal/imob/', { tenant: 'imob', path: '/' }],
    ['/portal/imob/imoveis', { tenant: 'imob', path: '/imoveis' }],
    ['/portal/imob/blog/meu-artigo', { tenant: 'imob', path: '/blog/meu-artigo' }],
    ['/portal/imob/p/sobre', { tenant: 'imob', path: '/p/sobre' }],
    ['/imovel/imob/AP0042', { tenant: 'imob', path: '/imovel/AP0042' }],
  ])('lmflow %s', (p, esperado) => {
    expect(paginaDoSite(LMFLOW, p)).toEqual(esperado);
  });

  it.each(['/', '/imoveis', '/login', '/conversas', '/portal/imob/settings', '/imovel/AP1', '/blog'])(
    'lmflow %s é do CRM (nada a fazer)', p => {
      expect(paginaDoSite(LMFLOW, p)).toBeNull();
    },
  );

  it.each(['/', '/imoveis', '/imovel/AP1', '/blog', '/blog/a', '/p/sobre', '/financiamento', '/anuncie'])(
    'domínio %s é página do site, com o cliente vindo do domínio', p => {
      expect(paginaDoSite(DOMINIO, p)).toEqual({ tenant: null, path: p });
    },
  );

  it('domínio: acento no caminho vai decodificado', () => {
    expect(paginaDoSite(DOMINIO, '/blog/caf%C3%A9')).toEqual({ tenant: null, path: '/blog/café' });
  });

  it.each(['/login', '/settings/x', '/imovel/imob/AP1', '/portal/imob'])('domínio %s não é página do site', p => {
    expect(paginaDoSite(DOMINIO, p)).toBeNull();
  });
});

describe('robotsTxt', () => {
  it('app.lmflow.com.br: Disallow: /, mesmo com dados de site indexável', () => {
    expect(robotsTxt(LMFLOW, DADOS)).toBe('User-agent: *\nDisallow: /\n');
    expect(robotsTxt('lmf-abc.vercel.app', DADOS)).toBe('User-agent: *\nDisallow: /\n');
  });

  it.each([
    ['sem site (servidor disse 404 ou caiu)', null],
    ['Google desligado', { ...DADOS, robots: 'noindex' }],
    ['em manutenção', { ...DADOS, maintenance: true }],
    ['site sem esse domínio ativo', { ...DADOS, domain: 'www.outro.com.br' }],
  ])('domínio %s: Disallow: /', (_n, dados) => {
    expect(robotsTxt(DOMINIO, dados)).toBe('User-agent: *\nDisallow: /\n');
  });

  it('domínio com o Google ligado: libera as páginas do site e aponta o sitemap', () => {
    const txt = robotsTxt(DOMINIO, DADOS);
    for (const linha of ['Allow: /$', 'Allow: /imoveis', 'Allow: /imovel/', 'Allow: /blog', 'Allow: /p/',
      'Allow: /financiamento', 'Allow: /anuncie', 'Allow: /assets/', 'Disallow: /']) {
      expect(txt.split('\n')).toContain(linha);
    }
    expect(txt).toContain(`Sitemap: https://${DOMINIO}/sitemap.xml`);
  });
});

describe('sitemapXml', () => {
  const xmlValido = (xml: string) => {
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    expect(d.getElementsByTagName('parsererror')).toHaveLength(0);
    return d;
  };

  it('XML válido com loc e lastmod, & escapado', () => {
    const xml = sitemapXml([
      { loc: `https://${DOMINIO}/` },
      { loc: `https://${DOMINIO}/imoveis?tab=rent&city=Campinas`, lastmod: '2026-10-04' },
      { loc: `https://${DOMINIO}/imovel/AP1`, lastmod: '2026-10-03T12:00:00Z' },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const d = xmlValido(xml);
    expect(d.documentElement.nodeName).toBe('urlset');
    expect(d.documentElement.getAttribute('xmlns')).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
    const locs = Array.from(d.getElementsByTagName('loc')).map(n => n.textContent);
    expect(locs).toEqual([`https://${DOMINIO}/`, `https://${DOMINIO}/imoveis?tab=rent&city=Campinas`, `https://${DOMINIO}/imovel/AP1`]);
    expect(Array.from(d.getElementsByTagName('lastmod')).map(n => n.textContent)).toEqual(['2026-10-04', '2026-10-03T12:00:00Z']);
  });

  it('lista vazia ainda é XML válido', () => {
    expect(xmlValido(sitemapXml([])).getElementsByTagName('url')).toHaveLength(0);
  });

  it('ignora endereço que não é http(s) e data fora do formato', () => {
    const xml = sitemapXml([{ loc: 'javascript:alert(1)' }, { loc: `https://${DOMINIO}/blog`, lastmod: 'ontem <b>' }]);
    const d = xmlValido(xml);
    expect(Array.from(d.getElementsByTagName('loc')).map(n => n.textContent)).toEqual([`https://${DOMINIO}/blog`]);
    expect(d.getElementsByTagName('lastmod')).toHaveLength(0);
  });
});

/* ── O middleware de ponta a ponta, com o fetch trocado ───────────────────── */

const API = 'https://api.test';
type Rota = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
let chamadas: { url: string; init?: RequestInit }[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** fetch que nunca responde, até o middleware desistir (abort). */
const pendurado = (init?: RequestInit) =>
  new Promise<Response>((_, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError')));
  });

function servidor(rota: Rota) {
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    chamadas.push({ url, init });
    if (url.endsWith('/index.html')) return new Response(INDEX_HTML, { status: 200 });
    if (url.endsWith('/lp.html')) return new Response(LP_HTML, { status: 200 });
    const r = rota(url, init);
    if (r) return r;
    return json({}, 404);
  }));
}

const pedir = (url: string) => middleware(new Request(url));
const seguiuDireto = (res: Response) => expect(res.headers.get('x-middleware-next')).toBe('1');

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('middleware: páginas do site', () => {
  it('domínio do cliente: busca o index.html e o head (cliente vem do host) e devolve o <head> do site', async () => {
    servidor(url => (url.startsWith(`${API}/api/public/v1/head`) ? json({ data: DADOS }) : undefined));
    const res = await pedir(`https://${DOMINIO}/imovel/AP1?finalidade=locacao`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    expect(res.headers.get('content-type')).toContain('text/html');
    const head = chamadas.find(c => c.url.includes('/head'))!;
    expect(head.url).toBe(`${API}/api/public/v1/head?host=${DOMINIO}&path=%2Fimovel%2FAP1`);
    expect(chamadas.map(c => c.url)).toContain(`https://${DOMINIO}/index.html`);
    const html = await res.text();
    expect(html).toContain('<title>Imob Teste · Imóveis em Campinas</title>');
    expect(html).toContain('window.__LMF_SITE__=');
  });

  it('endereço lmflow: /portal/<cliente>/blog/<slug> pergunta com o tenant e o caminho limpo, sem __LMF_SITE__', async () => {
    servidor(url => (url.includes('/head') ? json({ ...DADOS, canonical: `https://${DOMINIO}/blog/a` }) : undefined));
    const res = await pedir(`https://${LMFLOW}/portal/imob/blog/a`);
    expect(res.status).toBe(200);
    expect(chamadas.find(c => c.url.includes('/head'))!.url)
      .toBe(`${API}/api/public/v1/head?host=${LMFLOW}&path=%2Fblog%2Fa&tenant=imob`);
    const html = await res.text();
    expect(html).toContain(`<link rel="canonical" href="https://${DOMINIO}/blog/a" />`);
    expect(html).not.toContain('__LMF_SITE__');
  });

  it.each(['/', '/imoveis', '/blog'])('tela do CRM no endereço lmflow (%s) passa direto, sem buscar nada', async p => {
    servidor(() => json(DADOS));
    seguiuDireto(await pedir(`https://${LMFLOW}${p}`));
    expect(chamadas).toEqual([]);
  });

  it('500 do head: devolve o HTML de hoje', async () => {
    servidor(url => (url.includes('/head') ? json({ error: 'x' }, 500) : undefined));
    const res = await pedir(`https://${DOMINIO}/`);
    seguiuDireto(res);
    expect(res.body).toBeNull();
  });

  it('404 do head (domínio sem site ativo): devolve o HTML de hoje', async () => {
    servidor(() => undefined);
    seguiuDireto(await pedir(`https://${DOMINIO}/`));
  });

  it('head que demora mais de 2,5 s: desiste e devolve o HTML de hoje', async () => {
    vi.useFakeTimers();
    servidor((url, init) => (url.includes('/head') ? (pendurado(init) as Promise<Response>) : undefined));
    const pendente = pedir(`https://${DOMINIO}/imoveis`);
    await vi.advanceTimersByTimeAsync(2499);
    let pronto = false;
    void pendente.then(() => { pronto = true; });
    await Promise.resolve();
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    seguiuDireto(await pendente);
  });

  it('sem a variável da API: passa direto', async () => {
    vi.stubEnv('VITE_API_URL', '');
    servidor(() => json(DADOS));
    seguiuDireto(await pedir(`https://${DOMINIO}/`));
    expect(chamadas).toEqual([]);
  });
});

describe('middleware: robots.txt e sitemap.xml', () => {
  it('app.lmflow.com.br: Disallow: / sem perguntar ao servidor', async () => {
    servidor(() => json(DADOS));
    const res = await pedir(`https://${LMFLOW}/robots.txt`);
    expect(await res.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(chamadas).toEqual([]);
  });

  it('domínio indexável: Allow e Sitemap, perguntando o head do início', async () => {
    servidor(url => (url.includes('/head') ? json({ data: DADOS }) : undefined));
    const res = await pedir(`https://${DOMINIO}/robots.txt`);
    const txt = await res.text();
    expect(txt).toContain('Allow: /imoveis');
    expect(txt).toContain(`Sitemap: https://${DOMINIO}/sitemap.xml`);
    expect(chamadas[0].url).toBe(`${API}/api/public/v1/head?host=${DOMINIO}&path=%2F`);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
  });

  it('500 do servidor: Disallow: / e não guarda na borda', async () => {
    servidor(url => (url.includes('/head') ? json({}, 500) : undefined));
    const res = await pedir(`https://${DOMINIO}/robots.txt`);
    expect(await res.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('servidor que não responde: Disallow: / depois de 2,5 s', async () => {
    vi.useFakeTimers();
    servidor((url, init) => (url.includes('/head') ? (pendurado(init) as Promise<Response>) : undefined));
    const pendente = pedir(`https://${DOMINIO}/robots.txt`);
    await vi.advanceTimersByTimeAsync(2500);
    expect(await (await pendente).text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('sitemap do domínio: XML com as URLs do servidor', async () => {
    servidor(url => (url.includes('/sitemap') ? json({ urls: [{ loc: `https://${DOMINIO}/`, lastmod: '2026-10-04' }] }) : undefined));
    const res = await pedir(`https://${DOMINIO}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(chamadas[0].url).toBe(`${API}/api/public/v1/sitemap?host=${DOMINIO}`);
    expect(await res.text()).toContain(`<loc>https://${DOMINIO}/</loc><lastmod>2026-10-04</lastmod>`);
  });

  it('sitemap aceita a lista envolta em data', async () => {
    servidor(url => (url.includes('/sitemap') ? json({ data: { urls: [{ loc: `https://${DOMINIO}/blog` }] } }) : undefined));
    expect(await (await pedir(`https://${DOMINIO}/sitemap.xml`)).text()).toContain(`<loc>https://${DOMINIO}/blog</loc>`);
  });

  it('sitemap no endereço lmflow: 404 sem perguntar; servidor com 500: 503', async () => {
    servidor(url => (url.includes('/sitemap') ? json({}, 500) : undefined));
    expect((await pedir(`https://${LMFLOW}/sitemap.xml`)).status).toBe(404);
    expect(chamadas).toEqual([]);
    const res = await pedir(`https://${DOMINIO}/sitemap.xml`);
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('middleware: landing (/lp/*)', () => {
  const LANDING = { data: { title: 'Oferta', content_blocks: [] } };

  it('domínio: /lp/<slug>/obrigado lê o cliente do domínio, não o slug como cliente', async () => {
    servidor(url => {
      if (url.startsWith(`${API}/api/public/v1/resolve`)) return json({ tenant: 'imob', site_slug: 'imob-site', domain: DOMINIO });
      if (url.startsWith(`${API}/api/public/v1/landing/`)) return json(LANDING);
      return undefined;
    });
    const res = await pedir(`https://${DOMINIO}/lp/oferta/obrigado`);
    expect(res.status).toBe(200);
    expect(chamadas.find(c => c.url.includes('/resolve'))!.url).toBe(`${API}/api/public/v1/resolve?host=${DOMINIO}`);
    const landing = chamadas.find(c => c.url.includes('/landing/'))!;
    expect(landing.url).toBe(`${API}/api/public/v1/landing/oferta`);
    expect((landing.init?.headers as Record<string, string>)['X-Tenant']).toBe('imob');
    const html = await res.text();
    expect(html).toContain('window.__lmLanding={"tenant":"imob","slug":"oferta"');
    expect(html).toContain('<script>window.__LMF_SITE__={"tenant":"imob","slug":"imob-site"}</script>');
  });

  it('domínio sem site (resolve 404): segue para o lp.html cru', async () => {
    servidor(() => undefined);
    seguiuDireto(await pedir(`https://${DOMINIO}/lp/oferta`));
    expect(chamadas.some(c => c.url.includes('/landing/'))).toBe(false);
  });

  it('endereço lmflow: /lp/<cliente>/<slug> continua como antes', async () => {
    servidor(url => (url.startsWith(`${API}/api/public/v1/landing/`) ? json(LANDING) : undefined));
    const res = await pedir(`https://${LMFLOW}/lp/imob/oferta`);
    expect(res.status).toBe(200);
    expect(chamadas.some(c => c.url.includes('/resolve'))).toBe(false);
    const landing = chamadas.find(c => c.url.includes('/landing/'))!;
    expect(landing.url).toBe(`${API}/api/public/v1/landing/oferta`);
    expect((landing.init?.headers as Record<string, string>)['X-Tenant']).toBe('imob');
    expect(await res.text()).not.toContain('__LMF_SITE__');
  });
});
