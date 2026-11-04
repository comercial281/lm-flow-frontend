import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import middleware from '../middleware';
import {
  caminhoLimpo,
  htmlDoConteudo,
  llmsTxt,
  montarHead,
  paginaDoSite,
  respostaDaPagina,
  ROBOS,
  robotsTxt,
  sitemapXml,
  subdominioDoCliente,
  type ConteudoDaPagina,
  type DadosDoHead,
  type ResultadoDoHead,
} from './headDoSite';

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

/** O escape esperado no HTML (o mesmo do escapeHtml). */
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  it('og:url é sempre o canonical: url pedido no app.lmflow.com.br não vaza pra prévia do link', () => {
    const dados = { ...DADOS, url: 'https://app.lmflow.com.br/portal/imob/blog/a', canonical: `https://${DOMINIO}/blog/a` };
    const d = doc(montarHead(INDEX_HTML, dados, LMFLOW));
    expect(meta(d, 'meta[property="og:url"]')).toBe(`https://${DOMINIO}/blog/a`);
    expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://${DOMINIO}/blog/a`);
  });

  it('sem canonical, og:url cai no url do servidor', () => {
    const d = doc(montarHead(INDEX_HTML, { ...DADOS, canonical: null, url: `https://${DOMINIO}/x` }, DOMINIO));
    expect(meta(d, 'meta[property="og:url"]')).toBe(`https://${DOMINIO}/x`);
  });

  it('og:site_name com o nome do site (escapado); sem nome, a tag não sai', () => {
    const d = doc(montarHead(INDEX_HTML, { ...DADOS, site_name: 'Imob "Teste" & Cia', type: 'home' }, DOMINIO));
    expect(meta(d, 'meta[property="og:site_name"]')).toBe('Imob "Teste" & Cia');
    expect(montarHead(INDEX_HTML, { ...DADOS, site_name: 'Imob "Teste" & Cia' }, DOMINIO)).toContain('content="Imob &quot;Teste&quot; &amp; Cia"');
    expect(doc(montarHead(INDEX_HTML, { ...DADOS, site_name: null }, DOMINIO)).querySelector('meta[property="og:site_name"]')).toBeNull();
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

  it('códigos de verificação do Search Console e do Bing do cliente', () => {
    const d = doc(montarHead(INDEX_HTML, { ...DADOS, verification: { google: 'abcDEF123_-xyz', bing: '0123456789ABCDEF' } }, DOMINIO));
    expect(meta(d, 'meta[name="google-site-verification"]')).toBe('abcDEF123_-xyz');
    expect(meta(d, 'meta[name="msvalidate.01"]')).toBe('0123456789ABCDEF');
    const sem = doc(montarHead(INDEX_HTML, DADOS, DOMINIO));
    expect(sem.querySelector('meta[name="google-site-verification"]')).toBeNull();
    expect(sem.querySelector('meta[name="msvalidate.01"]')).toBeNull();
    const lixo = montarHead(INDEX_HTML, { ...DADOS, verification: { google: '"><script>x</script>', bing: 'curto' } }, DOMINIO);
    expect(lixo).not.toContain('google-site-verification');
    expect(lixo).not.toContain('msvalidate.01');
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

  /** Uma tag só, no lugar certo: `$` no texto não pode duplicar nem cortar o HTML. */
  const umHead = (html: string) => {
    expect(html.split('</head>')).toHaveLength(2);
    expect(html.split('<title>')).toHaveLength(2);
    expect(html.indexOf('</head>')).toBeLessThan(html.indexOf('<body>'));
  };

  it.each([
    ["título com R$' (o $' do replace colaria o resto do HTML)", "Casa R$' 500 mil"],
    ['título com $& (o replace colaria a tag trocada)', 'Promo $& oferta'],
    ['título com $$ (o replace viraria um $ só)', 'Preço $$ 300'],
  ])('%s', (_n, titulo) => {
    const html = montarHead(INDEX_HTML, { ...DADOS, title: titulo }, DOMINIO);
    umHead(html);
    expect(html).toContain(`<title>${esc(titulo)}</title>`);
    expect(html).toContain(`<meta property="og:title" content="${esc(titulo)}" />`);
    const d = doc(html);
    expect(d.title).toBe(titulo);
    expect(meta(d, 'meta[property="og:title"]')).toBe(titulo);
  });

  it('descrição com R$` e $& (o $` colaria o começo do HTML)', () => {
    const descricao = 'Entrada R$` 50 mil, $& e $$ sem pegadinha';
    const html = montarHead(INDEX_HTML, { ...DADOS, description: descricao }, DOMINIO);
    umHead(html);
    expect(html).toContain(`<meta name="description" content="${esc(descricao)}" />`);
    const d = doc(html);
    expect(d.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(meta(d, 'meta[name="description"]')).toBe(descricao);
    expect(meta(d, 'meta[property="og:description"]')).toBe(descricao);
  });

  it('$ na imagem, no canonical e no slug (a injeção antes do </head>) chega inteiro', () => {
    const html = montarHead(INDEX_HTML, {
      ...DADOS, image: "https://cdn.test/a$'b.jpg", canonical: 'https://www.imob.com.br/p/$&', site_slug: "s$`$'",
    }, DOMINIO);
    umHead(html);
    const d = doc(html);
    expect(meta(d, 'meta[property="og:image"]')).toBe("https://cdn.test/a$'b.jpg");
    expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.imob.com.br/p/$&');
    expect(html).toContain('window.__LMF_SITE__={"tenant":"imob","slug":"s$`$\'"}');
  });

  it('sem title do servidor, vai o nome do site; nunca sobra "LM Flow"', () => {
    const html = montarHead(INDEX_HTML, { ...DADOS, title: null, site_name: 'Imob Teste' }, DOMINIO);
    expect(doc(html).title).toBe('Imob Teste');
    expect(html).not.toContain('<title>LM Flow</title>');
  });

  it('sem title nem nome do site: "Imóveis"', () => {
    const html = montarHead(INDEX_HTML, { tenant: 'imob', title: null }, LMFLOW);
    expect(doc(html).title).toBe('Imóveis');
    expect(html).not.toContain('<title>LM Flow</title>');
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
    // Caminho que o site não tem também vai ao servidor: ele responde o 404 de verdade.
    ['/portal/imob/qualquer', { tenant: 'imob', path: '/qualquer' }],
  ])('lmflow %s', (p, esperado) => {
    expect(paginaDoSite(LMFLOW, p)).toEqual(esperado);
  });

  it.each(['/', '/imoveis', '/login', '/conversas', '/imovel/AP1', '/blog'])(
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

  it('domínio: qualquer caminho vai ao servidor (ele diz 404), menos a landing /lp', () => {
    expect(paginaDoSite(DOMINIO, '/qualquer/coisa/')).toEqual({ tenant: null, path: '/qualquer/coisa/' });
    expect(paginaDoSite(DOMINIO, '/imoveis/a-venda/casa/sorocaba')).toEqual({ tenant: null, path: '/imoveis/a-venda/casa/sorocaba' });
    expect(paginaDoSite(DOMINIO, '/lp/oferta')).toBeNull();
  });
});

describe('caminhoLimpo (endereço antigo colado no domínio)', () => {
  it.each([
    ['/portal/imob', '/'],
    ['/portal/imob/', '/'],
    ['/portal/imob/imoveis', '/imoveis'],
    ['/portal/imob/blog/a', '/blog/a'],
    ['/imoveis', null],
    ['/imovel/imob/AP1', null],
    ['/portal', null],
  ])('%s → %s', (p, esperado) => {
    expect(caminhoLimpo(p)).toBe(esperado);
  });
});

describe('htmlDoConteudo (o texto que o robô lê)', () => {
  const C: ConteudoDaPagina = {
    h1: 'Casa <b>com</b> quintal',
    intro: 'Em Sorocaba',
    price: 'R$ 500.000',
    facts: ['3 quartos', '130 m²'],
    image: { url: 'https://cdn.test/f.jpg', alt: 'Fachada "da" casa' },
    breadcrumbs: [{ name: 'Início', url: '/' }, { name: 'Imóveis', url: '/imoveis' }, { name: 'Casa', url: null }],
    items: [{ title: 'Outra casa', url: '/imovel/casa-sorocaba/A02', price: 'R$ 400.000', image: { url: 'https://cdn.test/g.jpg', alt: 'g' } }],
    faq: [{ q: 'Aceita financiamento?', a: 'Sim.' }, { q: 'Sem resposta', a: '' }],
    links: [{ name: 'Mau', url: 'javascript:alert(1)' }, { name: 'Protocolo relativo', url: '//mal.com/x' }, { name: 'Busca', url: '/imoveis' }],
  };

  it('um <h1> só, escapado, com migalhas, preço, fatos, foto sem lazy e cartões com lazy', () => {
    const d = doc(`<div>${htmlDoConteudo(C)}</div>`);
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('h1')!.textContent).toBe('Casa <b>com</b> quintal');
    expect(d.querySelectorAll('nav[aria-label="Você está em"] li')).toHaveLength(3);
    expect(d.body.textContent).toContain('R$ 500.000');
    expect(Array.from(d.querySelectorAll('ul li')).map(l => l.textContent)).toContain('130 m²');
    const [principal, cartao] = Array.from(d.querySelectorAll('img'));
    expect(principal.getAttribute('alt')).toBe('Fachada "da" casa');
    expect(principal.hasAttribute('loading')).toBe(false);
    expect(cartao.getAttribute('loading')).toBe('lazy');
    expect(d.querySelector('section h3 a')!.getAttribute('href')).toBe('/imovel/casa-sorocaba/A02');
  });

  it('FAQ sem resposta não sai; link javascript: e // perdem o href', () => {
    const d = doc(`<div>${htmlDoConteudo(C)}</div>`);
    expect(Array.from(d.querySelectorAll('section h3')).map(h => h.textContent)).toContain('Aceita financiamento?');
    expect(d.body.textContent).not.toContain('Sem resposta');
    const hrefs = Array.from(d.querySelectorAll('nav[aria-label="Veja também"] a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/imoveis']);
    expect(d.body.textContent).toContain('Mau');
  });

  it('sem h1 não sai nada (página sem conteúdo não ganha texto pela metade)', () => {
    expect(htmlDoConteudo({ intro: 'x' })).toBe('');
    expect(htmlDoConteudo(null)).toBe('');
  });

  it('montarHead põe o texto antes do #root, o estilo e um JSON-LD por item (sem </script> vazando)', () => {
    const html = montarHead(INDEX_HTML, {
      ...DADOS,
      content: C,
      jsonld: [{ '@type': 'RealEstateListing', name: '</script><script>alert(1)</script>' }, 'lixo', [1]],
    }, DOMINIO);
    const d = doc(html);
    const ssr = d.getElementById('lmf-ssr')!;
    expect(ssr).not.toBeNull();
    expect(ssr.nextElementSibling?.id).toBe('root');
    const ld = Array.from(d.querySelectorAll('script[type="application/ld+json"]'));
    expect(ld).toHaveLength(1);
    expect(JSON.parse(ld[0].textContent!)).toEqual({ '@type': 'RealEstateListing', name: '</script><script>alert(1)</script>' });
    expect(html).toContain('[data-carregando]{display:none!important}');
  });
});

describe('respostaDaPagina (o código que o Google recebe)', () => {
  const u = (s: string) => new URL(s);
  const ok = (dados: DadosDoHead): ResultadoDoHead => ({ tipo: 'ok', dados });

  it('servidor caiu: 503 com Retry-After e sem cache; sem HTML, deixa passar', () => {
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/`), { tipo: 'falhou' }))
      .toEqual({ status: 503, body: INDEX_HTML, cache: 'no-store', retryAfter: '120' });
    expect(respostaDaPagina(null, DOMINIO, u(`https://${DOMINIO}/`), { tipo: 'falhou' })).toBeNull();
  });

  it('sem site neste domínio: 404 noindex', () => {
    const r = respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/`), { tipo: 'sem-site' })!;
    expect(r.status).toBe(404);
    expect(meta(doc(r.body!), 'meta[name="robots"]')).toBe('noindex');
  });

  it('sem www → com www (e o contrário), mantendo caminho e query', () => {
    const r = respostaDaPagina(INDEX_HTML, 'imob.com.br', u('https://imob.com.br/imoveis?utm_source=meta'), ok(DADOS))!;
    expect(r).toMatchObject({ status: 301, location: `https://${DOMINIO}/imoveis?utm_source=meta` });
  });

  it('redirect do servidor no mesmo domínio: 301 com a query do pedido; de outro domínio é ignorado', () => {
    const certo = `https://${DOMINIO}/imovel/casa-sorocaba/A01`;
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/imovel/A01?gclid=x`), ok({ ...DADOS, redirect: certo })))
      .toMatchObject({ status: 301, location: `${certo}?gclid=x` });
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/imovel/A01`), ok({ ...DADOS, redirect: 'https://mal.com/x' }))!.status)
      .toBe(200);
  });

  it('endereço lmflow de um site com domínio: 301 pro domínio; na prévia do editor, não', () => {
    const dados = { ...DADOS, canonical: `https://${DOMINIO}/blog/a` };
    expect(respostaDaPagina(INDEX_HTML, LMFLOW, u(`https://${LMFLOW}/portal/imob/blog/a?x=1`), ok(dados)))
      .toMatchObject({ status: 301, location: `https://${DOMINIO}/blog/a?x=1` });
    expect(respostaDaPagina(INDEX_HTML, LMFLOW, u(`https://${LMFLOW}/portal/imob/blog/a?previa=1`), ok(dados))!.status).toBe(200);
  });

  it('410 do vendido e 404 do servidor saem com o HTML; código estranho vira 200', () => {
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/imovel/V01`), ok({ ...DADOS, status: 410 }))!.status).toBe(410);
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/x`), ok({ ...DADOS, status: 404 }))!.status).toBe(404);
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/`), ok({ ...DADOS, status: 302 }))!.status).toBe(200);
    expect(respostaDaPagina(INDEX_HTML, DOMINIO, u(`https://${DOMINIO}/`), ok({ ...DADOS, status: 503 })))
      .toMatchObject({ status: 503, cache: 'no-store', retryAfter: '120' });
  });
});

describe('llmsTxt', () => {
  it('domínio com o Google ligado: nome, descrição, páginas, imóveis e sitemap', () => {
    const txt = llmsTxt(DOMINIO, {
      ...DADOS,
      site_name: 'Imob Teste',
      content: { items: [{ title: 'Casa A01', url: '/imovel/casa-sorocaba/A01', price: 'R$ 500.000' }], links: [{ name: 'Mau', url: 'javascript:x' }] },
    })!;
    expect(txt.startsWith('# Imob Teste\n')).toBe(true);
    expect(txt).toContain(`> ${DADOS.description}`);
    expect(txt).toContain(`- [Todos os imóveis](https://${DOMINIO}/imoveis)`);
    expect(txt).toContain(`- [Casa A01](https://${DOMINIO}/imovel/casa-sorocaba/A01): R$ 500.000`);
    expect(txt).toContain(`- [sitemap.xml](https://${DOMINIO}/sitemap.xml)`);
    expect(txt).not.toContain('javascript');
  });

  it.each([
    ['endereço lmflow', LMFLOW, DADOS],
    ['Google desligado', DOMINIO, { ...DADOS, robots: 'noindex' }],
    ['sem dados', DOMINIO, null],
  ])('%s: null', (_n, host, dados) => {
    expect(llmsTxt(host, dados)).toBeNull();
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

  it('domínio com o Google ligado: o site inteiro aberto (menos /lp), os robôs de IA nomeados e o sitemap', () => {
    const linhas = robotsTxt(DOMINIO, DADOS).split('\n');
    for (const r of ROBOS) expect(linhas).toContain(`User-agent: ${r}`);
    expect(linhas).toContain('Allow: /');
    expect(linhas).toContain('Disallow: /lp/');
    expect(linhas).not.toContain('Disallow: /');
    expect(linhas).toContain(`Sitemap: https://${DOMINIO}/sitemap.xml`);
  });
});

describe('robotsTxt no subdomínio do cliente (imob.lmflow.com.br)', () => {
  const SUB = 'imob.lmflow.com.br';
  /** O head do /portal/imob num site sem domínio próprio, com o Google ligado. */
  const SEM_DOMINIO: DadosDoHead = { ...DADOS, domain: null, canonical: `https://${SUB}/portal/imob` };

  it.each([
    ['imob.lmflow.com.br', 'imob'],
    ['IMOB.lmflow.com.br.', 'imob'],
    ['app.lmflow.com.br', null],
    ['www.lmflow.com.br', null],
    ['api.lmflow.com.br', null],
    ['admin.lmflow.com.br', null],
    ['lmflow.com.br', null],
    ['a.b.lmflow.com.br', null],
    ['www.imob.com.br', null],
  ])('%s → %s', (host, slug) => {
    expect(subdominioDoCliente(host)).toBe(slug);
  });

  it('Google ligado e sem domínio: libera só /portal/imob e /imovel/imob, fecha o resto e aponta o sitemap', () => {
    const linhas = robotsTxt(SUB, SEM_DOMINIO).split('\n');
    for (const l of ['Allow: /portal/imob$', 'Allow: /portal/imob/', 'Allow: /imovel/imob/', 'Allow: /assets/', 'Disallow: /']) {
      expect(linhas).toContain(l);
    }
    expect(linhas).toContain('Sitemap: https://imob.lmflow.com.br/sitemap.xml');
    // Nada das telas do CRM nem dos caminhos limpos do domínio.
    expect(linhas.some(l => /^Allow: \/(\$|imoveis|blog|p\/)/.test(l))).toBe(false);
  });

  it.each([
    ['sem dados (404 ou falha)', null],
    ['Google desligado', { ...SEM_DOMINIO, robots: 'noindex' }],
    ['em manutenção', { ...SEM_DOMINIO, maintenance: true }],
    ['com domínio próprio ativo (o Google lê pelo domínio)', DADOS],
    ['head de outro cliente', { ...SEM_DOMINIO, tenant: 'outra' }],
  ])('%s: Disallow: /', (_n, dados) => {
    expect(robotsTxt(SUB, dados)).toBe('User-agent: *\nDisallow: /\n');
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

  it('endereço lmflow: /portal/<cliente>/blog/<slug> pergunta com o tenant e o caminho limpo e manda 301 pro domínio', async () => {
    servidor(url => (url.includes('/head') ? json({ ...DADOS, canonical: `https://${DOMINIO}/blog/a` }) : undefined));
    const res = await pedir(`https://${LMFLOW}/portal/imob/blog/a?utm_source=x`);
    expect(chamadas.find(c => c.url.includes('/head'))!.url)
      .toBe(`${API}/api/public/v1/head?host=${LMFLOW}&path=%2Fblog%2Fa&tenant=imob`);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`https://${DOMINIO}/blog/a?utm_source=x`);
  });

  it('endereço lmflow na prévia do editor: a página, com o canonical do domínio e sem __LMF_SITE__', async () => {
    servidor(url => (url.includes('/head') ? json({ ...DADOS, canonical: `https://${DOMINIO}/blog/a` }) : undefined));
    const res = await pedir(`https://${LMFLOW}/portal/imob/blog/a?previa=1`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<link rel="canonical" href="https://${DOMINIO}/blog/a" />`);
    expect(html).not.toContain('__LMF_SITE__');
  });

  it('endereço lmflow com o servidor fora: passa direto (é o CRM também)', async () => {
    servidor(url => (url.includes('/head') ? json({}, 500) : undefined));
    seguiuDireto(await pedir(`https://${LMFLOW}/portal/imob`));
  });

  it('domínio sem www: 301 pro www', async () => {
    servidor(url => (url.includes('/head') ? json({ data: DADOS }) : undefined));
    const res = await pedir('https://imob.com.br/imoveis?gclid=1');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`https://${DOMINIO}/imoveis?gclid=1`);
  });

  it('endereço antigo /portal/<cliente>/... no domínio: 301 pro limpo, sem perguntar ao servidor', async () => {
    servidor(() => json(DADOS));
    const res = await pedir(`https://${DOMINIO}/portal/imob/imoveis?x=1`);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/imoveis?x=1');
    expect(chamadas).toEqual([]);
  });

  it('imóvel vendido: 410 com o texto da página e o noindex', async () => {
    servidor(url => (url.includes('/head') ? json({ data: {
      ...DADOS, status: 410, robots: 'noindex', content: { h1: 'Este imóvel não está mais disponível', links: [{ name: 'Ver imóveis', url: '/imoveis' }] },
    } }) : undefined));
    const res = await pedir(`https://${DOMINIO}/imovel/V01`);
    expect(res.status).toBe(410);
    const d = doc(await res.text());
    expect(d.querySelector('#lmf-ssr h1')!.textContent).toBe('Este imóvel não está mais disponível');
    expect(meta(d, 'meta[name="robots"]')).toBe('noindex');
  });

  it('llms.txt do domínio: texto pras IAs; no endereço lmflow, 404', async () => {
    servidor(url => (url.includes('/head') ? json({ data: { ...DADOS, site_name: 'Imob' } }) : undefined));
    const res = await pedir(`https://${DOMINIO}/llms.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toContain('# Imob');
    expect((await pedir(`https://${LMFLOW}/llms.txt`)).status).toBe(404);
  });

  it.each(['/', '/imoveis', '/blog'])('tela do CRM no endereço lmflow (%s) passa direto, sem buscar nada', async p => {
    servidor(() => json(DADOS));
    seguiuDireto(await pedir(`https://${LMFLOW}${p}`));
    expect(chamadas).toEqual([]);
  });

  /** Servidor fora no domínio: o visitante vê o app; o Google ouve "volte depois" e não tira a página do índice. */
  const voltaDepois = async (res: Response) => {
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('120');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe(INDEX_HTML);
  };

  it('500 do head no domínio: 503 com o HTML do app', async () => {
    servidor(url => (url.includes('/head') ? json({ error: 'x' }, 500) : undefined));
    await voltaDepois(await pedir(`https://${DOMINIO}/`));
  });

  it('head 200 que não é JSON: 503', async () => {
    servidor(url => (url.includes('/head') ? new Response('<html>erro do proxy</html>', { status: 200 }) : undefined));
    await voltaDepois(await pedir(`https://${DOMINIO}/`));
  });

  it.each([['{}', {}], ['{ data: {} }', { data: {} }], ['{ data: null }', { data: null }]])(
    'head 200 com %s: 503', async (_n, corpo) => {
      servidor(url => (url.includes('/head') ? json(corpo) : undefined));
      await voltaDepois(await pedir(`https://${DOMINIO}/imoveis`));
    },
  );

  it('head só com tenant (sem title): página do site sai com "Imóveis", não "LM Flow"', async () => {
    servidor(url => (url.includes('/head') ? json({ data: { tenant: 'imob', domain: DOMINIO, robots: 'noindex' } }) : undefined));
    const html = await (await pedir(`https://${DOMINIO}/`)).text();
    expect(html).toContain('<title>Imóveis</title>');
    expect(html).not.toContain('<title>LM Flow</title>');
  });

  it('404 do head (domínio sem site ativo): 404 noindex', async () => {
    servidor(() => undefined);
    const res = await pedir(`https://${DOMINIO}/`);
    expect(res.status).toBe(404);
    expect(meta(doc(await res.text()), 'meta[name="robots"]')).toBe('noindex');
  });

  it('head que demora mais de 3 s: desiste e responde 503', async () => {
    vi.useFakeTimers();
    servidor((url, init) => (url.includes('/head') ? (pendurado(init) as Promise<Response>) : undefined));
    const pendente = pedir(`https://${DOMINIO}/imoveis`);
    await vi.advanceTimersByTimeAsync(2999);
    let pronto = false;
    void pendente.then(() => { pronto = true; });
    await Promise.resolve();
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await voltaDepois(await pendente);
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
    expect(txt.split('\n')).toContain('Allow: /');
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

  it('servidor que não responde: Disallow: / depois de 3 s', async () => {
    vi.useFakeTimers();
    servidor((url, init) => (url.includes('/head') ? (pendurado(init) as Promise<Response>) : undefined));
    const pendente = pedir(`https://${DOMINIO}/robots.txt`);
    let pronto = false;
    void pendente.then(() => { pronto = true; });
    await vi.advanceTimersByTimeAsync(2999);
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
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

  it('subdomínio do cliente indexável: pergunta o head do /portal/<cliente> e libera o site', async () => {
    const SUB = 'imob.lmflow.com.br';
    servidor(url => (url.includes('/head') ? json({ data: { ...DADOS, domain: null } }) : undefined));
    const res = await pedir(`https://${SUB}/robots.txt`);
    const txt = await res.text();
    expect(chamadas[0].url).toBe(`${API}/api/public/v1/head?host=${SUB}&path=%2Fportal%2Fimob&tenant=imob`);
    expect(txt).toContain('Allow: /portal/imob/');
    expect(txt).toContain('Allow: /imovel/imob/');
    expect(txt).toContain(`Sitemap: https://${SUB}/sitemap.xml`);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
  });

  it('subdomínio do cliente com o Google desligado: Disallow: /', async () => {
    servidor(url => (url.includes('/head') ? json({ data: { ...DADOS, domain: null, robots: 'noindex' } }) : undefined));
    expect(await (await pedir('https://imob.lmflow.com.br/robots.txt')).text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it.each(['app', 'www', 'api', 'admin'])('%s.lmflow.com.br: Disallow: / sem perguntar ao servidor', async sub => {
    servidor(() => json({ data: { ...DADOS, domain: null } }));
    expect(await (await pedir(`https://${sub}.lmflow.com.br/robots.txt`)).text()).toBe('User-agent: *\nDisallow: /\n');
    expect(chamadas).toEqual([]);
  });

  it('sitemap do subdomínio do cliente: pergunta com host e tenant e devolve o XML', async () => {
    const SUB = 'imob.lmflow.com.br';
    servidor(url => (url.includes('/sitemap')
      ? json({ data: { tenant: 'imob', domain: null, urls: [{ loc: `https://${SUB}/portal/imob` }] } })
      : undefined));
    const res = await pedir(`https://${SUB}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(chamadas[0].url).toBe(`${API}/api/public/v1/sitemap?host=${SUB}&tenant=imob`);
    expect(await res.text()).toContain(`<loc>https://${SUB}/portal/imob</loc>`);
  });

  it('sitemap do subdomínio de um site com domínio ativo: 404 (o sitemap mora no domínio)', async () => {
    servidor(url => (url.includes('/sitemap')
      ? json({ data: { tenant: 'imob', domain: DOMINIO, urls: [{ loc: `https://${DOMINIO}/` }] } })
      : undefined));
    expect((await pedir('https://imob.lmflow.com.br/sitemap.xml')).status).toBe(404);
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

  it('domínio: $ no slug do site e no título da landing não corta o lp.html', async () => {
    servidor(url => {
      if (url.includes('/resolve')) return json({ tenant: 'imob', site_slug: "s$'$&", domain: DOMINIO });
      if (url.includes('/landing/')) return json({ data: { title: "Casa R$' 500 mil $&", content_blocks: [] } });
      return undefined;
    });
    const html = await (await pedir(`https://${DOMINIO}/lp/oferta`)).text();
    expect(html.split('</head>')).toHaveLength(2);
    expect(html.split('<title>')).toHaveLength(2);
    expect(html).toContain('<script>window.__LMF_SITE__={"tenant":"imob","slug":"s$\'$\\u0026"}</script>');
    expect(html).toContain('<title>Casa R$&#39; 500 mil $&amp;</title>');
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
