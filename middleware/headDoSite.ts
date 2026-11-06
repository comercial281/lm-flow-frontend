/**
 * O `<head>`, o `robots.txt` e o `sitemap.xml` do site do cliente, montados na
 * borda pelo `middleware.ts` (raiz).
 *
 * POR QUE ISTO EXISTE
 * O site é um app de navegador: o HTML que sai da Vercel é o mesmo `index.html`
 * do CRM ("LM Flow", `noindex`, manifest do PWA). O robô do Google e a prévia
 * do WhatsApp leem esse HTML cru, antes de qualquer código rodar. Sem isto, todo
 * site sairia com o título "LM Flow" e sem foto no link compartilhado.
 *
 * Funções PURAS, sem rede: o middleware busca os dados no backend
 * (`GET /api/public/v1/head` e `/sitemap`) e só chama estas funções.
 *
 * ARMADILHA: roda no runtime de borda. Só APIs Web e imports relativos (o
 * apelido `@/` é do Vite, não do empacotador do middleware).
 */
import { escapeHtml, jsonForScript } from '../src/features/landing/public/landingHtml';
import { ehEnderecoDoSistema, limparHost } from '../src/features/siteBuilder/public/dominioDoSite';

/** Resposta de `GET /api/public/v1/head`. Tudo opcional: servidor velho manda menos. */
export interface DadosDoHead {
  tenant?: string | null;
  site_slug?: string | null;
  /** Domínio ativo do site, ou null. */
  domain?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
  canonical?: string | null;
  /** `index,follow` só com o Google ligado, site publicado e fora da prévia. */
  robots?: string | null;
  maintenance?: boolean | null;
  /** Tipo da página: `home`, `search`, `property`, `blog`, `article`, `page`, `financing`, `listing`, `landing`. */
  type?: string | null;
  /** Nome do site (vira o `og:site_name` e o título de reserva). */
  site_name?: string | null;
  name?: string | null;
  /** Código de resposta da página: 200, 404 (não existe), 410 (imóvel vendido), 503 (falha no servidor). */
  status?: number | null;
  /** Endereço oficial quando o pedido veio num endereço antigo ou torto: vira 301. */
  redirect?: string | null;
  /** O texto da página, para o HTML que o robô lê antes do código rodar. */
  content?: ConteudoDaPagina | null;
  /** Dados estruturados (schema.org), um `<script type="application/ld+json">` cada. */
  jsonld?: unknown[] | null;
  /** Códigos de verificação do Search Console e do Bing — da conta do CLIENTE. */
  verification?: { google?: string | null; bing?: string | null } | null;
}

export interface LinkDaPagina {
  name?: string | null;
  url?: string | null;
}

export interface ItemDaPagina {
  title?: string | null;
  url?: string | null;
  price?: string | null;
  summary?: string | null;
  date?: string | null;
  image?: { url?: string | null; alt?: string | null } | null;
}

/** `content` do `head`: cada página manda só o que tem. */
export interface ConteudoDaPagina {
  h1?: string | null;
  intro?: string | null;
  price?: string | null;
  facts?: string[] | null;
  image?: { url?: string | null; alt?: string | null } | null;
  paragraphs?: string[] | null;
  /** HTML do artigo, já limpo no servidor (sanitize do Rails). */
  body_html?: string | null;
  author?: string | null;
  date?: string | null;
  breadcrumbs?: LinkDaPagina[] | null;
  items?: ItemDaPagina[] | null;
  articles?: ItemDaPagina[] | null;
  faq?: { q?: string | null; a?: string | null }[] | null;
  links?: LinkDaPagina[] | null;
}

/** Título que vai no `<title>` quando o servidor não manda `title`. */
export const TITULO_PADRAO = 'Imóveis';

export interface UrlDoSitemap {
  loc: string;
  lastmod?: string | null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/* ── Que página do site é esta ────────────────────────────────────────────── */

/** Página do site reconhecida no caminho. `tenant` null = vem do domínio. */
export interface PaginaDoSite {
  tenant: string | null;
  /** Caminho LIMPO (o do domínio): `/`, `/imovel/AP01`, `/blog/<slug>`… */
  path: string;
}

/**
 * Trava: no endereço do sistema (lmflow) só passam as páginas que já passavam
 * antes do "site que ranqueia" — o resto segue direto pro app, como sempre.
 * O comportamento novo (qualquer caminho, 404/410 de verdade) é só do domínio.
 */
const LIMPOS_DO_SISTEMA = [
  /^\/$/,
  /^\/imoveis$/,
  /^\/imovel\/[^/]+$/,
  /^\/blog$/,
  /^\/blog\/[^/]+$/,
  /^\/p\/[^/]+$/,
  /^\/financiamento$/,
  /^\/anuncie$/,
];

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Lê o caminho e diz se é página do site:
 * - endereço do sistema: `/portal/<cliente>/<página de LIMPOS_DO_SISTEMA>` e
 *   `/imovel/<cliente>/<código>` (o resto é o CRM, null: nada a fazer);
 * - domínio do cliente: QUALQUER caminho. Quem diz se a página existe é o
 *   servidor (404 de verdade, nunca o início com código 200). `/lp` tem
 *   tratamento próprio e não chega aqui.
 */
export function paginaDoSite(host: string, pathname: string): PaginaDoSite | null {
  const partes = pathname.split('/').filter(Boolean).map(decodificar);
  if (ehEnderecoDoSistema(host)) {
    if (partes[0] === 'portal' && partes[1]) {
      const path = `/${partes.slice(2).join('/')}`;
      return LIMPOS_DO_SISTEMA.some(r => r.test(path)) ? { tenant: partes[1], path } : null;
    }
    if (partes[0] === 'imovel' && partes.length === 3) {
      return { tenant: partes[1], path: `/imovel/${partes[2]}` };
    }
    return null;
  }
  if (partes[0] === 'lp') return null;
  // Barra no fim e maiúscula vão como vieram (o servidor decide o 301); só o acento é decodificado.
  return { tenant: null, path: decodificar(pathname) || '/' };
}

/**
 * Endereço antigo colado no domínio (/portal/<cliente>/<resto>) → o caminho
 * limpo, para o 301. Null quando não é. O /imovel/<cliente>/<código> antigo não
 * precisa: o servidor lê o 1º pedaço como texto errado e já manda o 301.
 */
export function caminhoLimpo(pathname: string): string | null {
  const portal = /^\/portal\/[^/]+(\/.*)?$/.exec(pathname);
  if (!portal) return null;
  return portal[1] && portal[1] !== '/' ? portal[1] : '/';
}

/* ── <head> ───────────────────────────────────────────────────────────────── */

/** Só o que é valor de robots (`index,follow`, `noindex`). Qualquer outra coisa vira `noindex`. */
function robotsSeguro(dados: DadosDoHead): string {
  if (dados.maintenance) return 'noindex';
  const r = texto(dados.robots);
  return r && /^[a-z, -]+$/i.test(r) ? r : 'noindex';
}

/** O site está aberto no domínio ativo dele (e não no endereço lmflow). */
export function noDominioAtivo(host: string, dados: DadosDoHead | null): boolean {
  const dominio = texto(dados?.domain);
  if (!dominio || !texto(dados?.tenant)) return false;
  const h = limparHost(host);
  return !ehEnderecoDoSistema(h) && limparHost(dominio) === h;
}

/** `<script>window.__LMF_SITE__=…</script>`: o front não precisa chamar o `resolve`. */
export function scriptDoSite(tenant: string, slug: string | null): string {
  return `<script>window.__LMF_SITE__=${jsonForScript({ tenant, slug: slug || tenant })}</script>`;
}

/**
 * Manifest e metas do PWA do CRM: no domínio do cliente o navegador não pode
 * oferecer "Instalar LM Flow".
 */
const TAGS_DO_APP = [
  /\s*<!--\s*PWA manifest\s*-->/i,
  /\s*<!--\s*iOS PWA\s*-->/i,
  /\s*<link\b[^>]*\brel=["']manifest["'][^>]*>/gi,
  /\s*<meta\b[^>]*\bname=["']apple-mobile-web-app-[^"']*["'][^>]*>/gi,
  /\s*<meta\b[^>]*\bname=["']mobile-web-app-capable["'][^>]*>/gi,
  /\s*<meta\b[^>]*\bname=["']application-name["'][^>]*>/gi,
];

const META_ROBOTS = /<meta\b[^>]*\bname=["']robots["'][^>]*>/i;
const META_DESCRIPTION = /<meta\b[^>]*\bname=["']description["'][^>]*>/i;
const TITULO = /<title>[\s\S]*?<\/title>/i;

/* ── O texto da página no HTML ──────────────────────────────────────────── */

/** Só endereço http(s) ou caminho do próprio site. `javascript:` e afins viram null. */
function urlSegura(v: unknown): string | null {
  const u = texto(v);
  if (!u) return null;
  return /^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')) ? u : null;
}

function lista<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v.filter(x => x != null) : [];
}

function link(nome: unknown, url: unknown): string {
  const n = texto(nome);
  if (!n) return '';
  const u = urlSegura(url);
  return u ? `<a href="${escapeHtml(u)}">${escapeHtml(n)}</a>` : escapeHtml(n);
}

function imagem(img: { url?: string | null; alt?: string | null } | null | undefined, lazy: boolean): string {
  const src = urlSegura(img?.url);
  if (!src) return '';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(texto(img?.alt) ?? '')}"${lazy ? ' loading="lazy"' : ''} decoding="async" />`;
}

function cartao(it: ItemDaPagina, nivel: 'h2' | 'h3'): string {
  const titulo = link(it.title, it.url);
  if (!titulo) return '';
  const partes = [
    imagem(it.image, true),
    `<${nivel}>${titulo}</${nivel}>`,
    texto(it.price) ? `<p><strong>${escapeHtml(texto(it.price)!)}</strong></p>` : '',
    texto(it.date) ? `<p><time datetime="${escapeHtml(texto(it.date)!)}">${escapeHtml(texto(it.date)!.slice(0, 10))}</time></p>` : '',
    texto(it.summary) ? `<p>${escapeHtml(texto(it.summary)!)}</p>` : '',
  ];
  return `<article>${partes.filter(Boolean).join('')}</article>`;
}

/**
 * O conteúdo da página em HTML puro: migalhas, UM `<h1>`, preço, características,
 * foto com `alt`, texto, imóveis, perguntas frequentes e links internos. É o que
 * o robô (Google, ChatGPT, Perplexity…) lê sem rodar o código do site; o
 * visitante vê isto só até o site de verdade desenhar a página por cima.
 *
 * Todo texto passa por escape. A exceção é o `body_html` do artigo, que o
 * servidor já limpou (sanitize do Rails) e chega como HTML de propósito.
 */
export function htmlDoConteudo(c: ConteudoDaPagina | null | undefined): string {
  if (!c || typeof c !== 'object') return '';
  const h1 = texto(c.h1);
  if (!h1) return '';
  const out: string[] = [];

  const migalhas = lista(c.breadcrumbs).map(b => link(b.name, b.url)).filter(Boolean);
  if (migalhas.length > 1) out.push(`<nav aria-label="Você está em"><ol>${migalhas.map(m => `<li>${m}</li>`).join('')}</ol></nav>`);

  out.push(`<h1>${escapeHtml(h1)}</h1>`);
  if (texto(c.intro)) out.push(`<p>${escapeHtml(texto(c.intro)!)}</p>`);
  if (texto(c.price)) out.push(`<p><strong>${escapeHtml(texto(c.price)!)}</strong></p>`);
  const fatos = lista(c.facts).map(texto).filter((f): f is string => !!f);
  if (fatos.length) out.push(`<ul>${fatos.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`);
  // Foto principal da página: sem lazy (é a primeira coisa que aparece).
  out.push(imagem(c.image, false));
  if (texto(c.author) || texto(c.date)) {
    const quem = texto(c.author) ? `Por ${escapeHtml(texto(c.author)!)}` : '';
    const quando = texto(c.date) ? `<time datetime="${escapeHtml(texto(c.date)!)}">${escapeHtml(texto(c.date)!.slice(0, 10))}</time>` : '';
    out.push(`<p>${[quem, quando].filter(Boolean).join(' · ')}</p>`);
  }
  for (const par of lista(c.paragraphs)) if (texto(par)) out.push(`<p>${escapeHtml(texto(par)!)}</p>`);
  const corpo = texto(c.body_html);
  if (corpo) out.push(`<div>${corpo}</div>`);

  const itens = lista(c.items).map(it => cartao(it, 'h3')).filter(Boolean);
  if (itens.length) out.push(`<section><h2>Imóveis</h2>${itens.join('')}</section>`);
  const artigos = lista(c.articles).map(it => cartao(it, 'h3')).filter(Boolean);
  if (artigos.length) out.push(`<section><h2>Artigos</h2>${artigos.join('')}</section>`);

  const faq = lista(c.faq).filter(f => texto(f.q) && texto(f.a));
  if (faq.length) {
    out.push(`<section><h2>Perguntas frequentes</h2>${faq.map(f => `<h3>${escapeHtml(texto(f.q)!)}</h3><p>${escapeHtml(texto(f.a)!)}</p>`).join('')}</section>`);
  }
  const links = lista(c.links).map(l => link(l.name, l.url)).filter(Boolean);
  if (links.length) out.push(`<nav aria-label="Veja também"><h2>Veja também</h2><ul>${links.map(l => `<li>${l}</li>`).join('')}</ul></nav>`);

  return out.filter(Boolean).join('');
}

/**
 * O texto do servidor é pra robô, não pra gente: fica no HTML (o Bing e os
 * robôs de IA leem o código, não a tela) mas fora da vista, com o padrão de
 * "só leitor de tela". Quem visita vê o "Carregando…" do site até o app
 * desenhar, e não uma página crua de letra do navegador (era o que aparecia
 * por ~1 s antes deste estilo). O Google roda o app e lê a página final, de
 * onde o `textoDoServidor.ts` já tirou este bloco. Não usar `display:none`:
 * aí sim parece texto escondido de propósito.
 */
const ESTILO_DO_TEXTO =
  '<style>#lmf-ssr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;' +
  'overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap}</style>';

/** `<script type="application/ld+json">` de cada item (só objeto). `jsonForScript` escapa `<`, `>` e `&`. */
function scriptsDeDados(jsonld: unknown): string[] {
  if (!Array.isArray(jsonld)) return [];
  return jsonld
    .filter(j => j && typeof j === 'object' && !Array.isArray(j))
    .map(j => `<script type="application/ld+json">${jsonForScript(j)}</script>`);
}

const RAIZ = /<div id="root"><\/div>/;

/** Código de verificação (Search Console / Bing): só letra, número, `_` e `-`. */
function codigoDeVerificacao(v: unknown): string | null {
  const c = texto(v);
  return c && /^[A-Za-z0-9_-]{10,100}$/.test(c) ? c : null;
}

/**
 * Costura no `index.html` o título, a descrição, as tags de prévia do link
 * (`og:*`, `twitter:card`), o `canonical`, o `robots` e, no domínio ativo, o
 * `window.__LMF_SITE__`. Tudo que vem do servidor passa por escape.
 *
 * Sem `</head>` no HTML, devolve como veio: nunca quebra a página.
 */
export function montarHead(html: string, dados: DadosDoHead, host: string): string {
  if (!html.includes('</head>')) return html;
  let out = html;

  // O "LM Flow" do index.html nunca sobra na página do cliente: sem título do
  // servidor, vai o nome do site, ou "Imóveis".
  const titulo = texto(dados.title) ?? texto(dados.site_name) ?? texto(dados.name);
  const tituloDaPagina = titulo ?? TITULO_PADRAO;
  const temTitulo = TITULO.test(out);
  if (temTitulo) out = out.replace(TITULO, () => `<title>${escapeHtml(tituloDaPagina)}</title>`);

  const descricao = texto(dados.description);
  // A descrição do CRM ("LM Flow — CRM imobiliário…") nunca é a do site.
  out = out.replace(META_DESCRIPTION, () => (descricao ? `<meta name="description" content="${escapeHtml(descricao)}" />` : ''));

  const robots = robotsSeguro(dados);
  const metaRobots = `<meta name="robots" content="${escapeHtml(robots)}" />`;
  out = META_ROBOTS.test(out) ? out.replace(META_ROBOTS, () => metaRobots) : out;

  const dominio = noDominioAtivo(host, dados);
  if (dominio) for (const r of TAGS_DO_APP) out = out.replace(r, '');

  const imagem = texto(dados.image);
  const canonical = texto(dados.canonical);
  // O `og:url` é SEMPRE o canonical: o `url` do servidor é o endereço pedido, que
  // pode ser o app.lmflow.com.br, e a prévia do link apontaria pra lá.
  const url = canonical ?? texto(dados.url);
  const nomeDoSite = texto(dados.site_name);
  const tags: string[] = [];
  if (!temTitulo) tags.push(`<title>${escapeHtml(tituloDaPagina)}</title>`);
  if (!META_ROBOTS.test(out)) tags.push(metaRobots);
  tags.push('<meta property="og:type" content="website" />');
  tags.push('<meta property="og:locale" content="pt_BR" />');
  if (nomeDoSite) tags.push(`<meta property="og:site_name" content="${escapeHtml(nomeDoSite)}" />`);
  if (titulo) tags.push(`<meta property="og:title" content="${escapeHtml(titulo)}" />`);
  if (descricao) tags.push(`<meta property="og:description" content="${escapeHtml(descricao)}" />`);
  if (imagem) tags.push(`<meta property="og:image" content="${escapeHtml(imagem)}" />`);
  if (url) tags.push(`<meta property="og:url" content="${escapeHtml(url)}" />`);
  tags.push(`<meta name="twitter:card" content="${imagem ? 'summary_large_image' : 'summary'}" />`);
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  // Trava: verificação, JSON-LD e texto do servidor só no domínio do cliente.
  // No endereço lmflow o head fica o de antes.
  const novo = !ehEnderecoDoSistema(limparHost(host));
  const verificacao = novo ? dados.verification : null;
  const codigoGoogle = codigoDeVerificacao(verificacao?.google);
  const codigoBing = codigoDeVerificacao(verificacao?.bing);
  if (codigoGoogle) tags.push(`<meta name="google-site-verification" content="${escapeHtml(codigoGoogle)}" />`);
  if (codigoBing) tags.push(`<meta name="msvalidate.01" content="${escapeHtml(codigoBing)}" />`);
  if (dominio) tags.push(scriptDoSite(texto(dados.tenant)!, texto(dados.site_slug)));
  if (novo) tags.push(...scriptsDeDados(dados.jsonld));

  const conteudo = novo ? htmlDoConteudo(dados.content) : null;
  if (conteudo && RAIZ.test(out)) {
    tags.push(ESTILO_DO_TEXTO);
    out = out.replace(RAIZ, () => `<div id="lmf-ssr">${conteudo}</div>\n    <div id="root"></div>`);
  }

  return out.replace('</head>', () => `    ${tags.join('\n    ')}\n  </head>`);
}

/* ── robots.txt ───────────────────────────────────────────────────────────── */

const ROBOTS_FECHADO = 'User-agent: *\nDisallow: /\n';

/**
 * Quem lê o site: o `*` (Google, Bing…) e, pelo nome, os robôs das IAs que
 * respondem perguntas (ChatGPT, Claude, Perplexity, Gemini, Apple). Alguns só
 * seguem regra que cita o nome deles.
 */
export const ROBOS = [
  '*',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];

/** Subdomínios lmflow que são do sistema, nunca de um cliente. */
const SUBDOMINIOS_DO_SISTEMA = new Set(['app', 'www', 'api', 'admin']);

/**
 * O cliente do subdomínio lmflow (`imob.lmflow.com.br` → `imob`), ou null.
 * `app`, `www`, `api`, `admin`, o `lmflow.com.br` puro e subdomínio de dois
 * níveis não são de cliente.
 */
export function subdominioDoCliente(host: string): string | null {
  const m = /^([a-z0-9-]+)\.lmflow\.com\.br$/.exec(limparHost(host));
  if (!m || SUBDOMINIOS_DO_SISTEMA.has(m[1])) return null;
  return m[1];
}

/** O `head` liberou o Google (`index`, sem `noindex`). */
function liberaGoogle(dados: DadosDoHead): boolean {
  const robots = robotsSeguro(dados).toLowerCase();
  return !robots.includes('noindex') && robots.includes('index');
}

/**
 * `robots.txt` do subdomínio do cliente (`imob.lmflow.com.br`), sem domínio
 * próprio ativo: o Google lê o site por aqui. Libera só as páginas do site
 * desse cliente (`/portal/imob…` e `/imovel/imob/…`) e o código que desenha a
 * página; as telas do CRM, que dividem o endereço, ficam fechadas.
 *
 * Com domínio ativo o Google lê pelo domínio, e aqui fecha tudo (senão o mesmo
 * site seria lido em dois endereços).
 */
function robotsDoSubdominio(slug: string, dados: DadosDoHead | null): string {
  if (!dados || texto(dados.domain) || !liberaGoogle(dados)) return ROBOTS_FECHADO;
  const tenant = texto(dados.tenant)?.toLowerCase();
  if (tenant && tenant !== slug) return ROBOTS_FECHADO;
  return [
    ...ROBOS.map(r => `User-agent: ${r}`),
    `Allow: /portal/${slug}$`,
    `Allow: /portal/${slug}/`,
    `Allow: /imovel/${slug}/`,
    'Allow: /assets/',
    'Allow: /favicon',
    'Disallow: /',
    '',
    `Sitemap: https://${slug}.lmflow.com.br/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * O `robots.txt` de cada endereço:
 * - endereço do sistema (app.lmflow.com.br…), domínio sem site, servidor fora
 *   ou Google desligado: `Disallow: /`;
 * - subdomínio do cliente (`imob.lmflow.com.br`) sem domínio próprio e com o
 *   Google ligado: ver `robotsDoSubdominio`;
 * - domínio ativo com o Google ligado: libera as páginas do site (e o código
 *   que desenha a página, senão o Google vê a tela em branco), fecha o resto e
 *   aponta o sitemap.
 */
export function robotsTxt(host: string, dados: DadosDoHead | null): string {
  const h = limparHost(host);
  const slug = subdominioDoCliente(h);
  if (slug) return robotsDoSubdominio(slug, dados);
  if (ehEnderecoDoSistema(h) || !dados || !noDominioAtivo(h, dados)) return ROBOTS_FECHADO;
  if (!liberaGoogle(dados)) return ROBOTS_FECHADO;
  // Domínio próprio é o site inteiro: tudo liberado, menos as landing pages de
  // anúncio (/lp), que não são para busca.
  return [
    ...ROBOS.map(r => `User-agent: ${r}`),
    'Allow: /',
    'Disallow: /lp/',
    '',
    `Sitemap: https://${h}/sitemap.xml`,
    '',
  ].join('\n');
}

/* ── llms.txt ─────────────────────────────────────────────────────────────── */

/**
 * `llms.txt` do domínio (padrão llmstxt.org): um resumo em texto do site para
 * as IAs (ChatGPT, Claude, Perplexity) acharem o que importa sem ler tudo.
 * Montado do `head` da página inicial: nome, descrição, links, imóveis em
 * destaque e artigos. Google desligado ou sem dado = null (o middleware
 * responde 404).
 */
export function llmsTxt(host: string, dados: DadosDoHead | null): string | null {
  const h = limparHost(host);
  if (!dados || !noDominioAtivo(h, dados) || !liberaGoogle(dados)) return null;
  const nome = texto(dados.site_name) ?? texto(dados.title) ?? h;
  const c = dados.content ?? {};
  const linha = (it: { name?: string | null; title?: string | null; url?: string | null; summary?: string | null; price?: string | null }) => {
    const n = texto(it.name) ?? texto(it.title);
    const u = urlSegura(it.url);
    if (!n || !u) return null;
    const abs = u.startsWith('/') ? `https://${h}${u}` : u;
    const extra = [texto(it.price), texto(it.summary)].filter(Boolean).join(' — ');
    return `- [${n}](${abs})${extra ? `: ${extra}` : ''}`;
  };
  const secao = (titulo: string, itens: (string | null)[]) => {
    const l = itens.filter((x): x is string => !!x);
    return l.length ? ['', `## ${titulo}`, '', ...l] : [];
  };
  return [
    `# ${nome}`,
    '',
    ...(texto(dados.description) ? [`> ${texto(dados.description)}`] : []),
    ...secao('Páginas', [
      linha({ name: 'Início', url: `https://${h}/` }),
      linha({ name: 'Todos os imóveis', url: `https://${h}/imoveis` }),
      ...lista(c.links).map(linha),
    ]),
    ...secao('Imóveis em destaque', lista(c.items).map(linha)),
    ...secao('Artigos', lista(c.articles).map(linha)),
    ...secao('Mapa do site', [`- [sitemap.xml](https://${h}/sitemap.xml)`]),
    '',
  ].join('\n');
}

/* ── A resposta da página ─────────────────────────────────────────────────── */

/** O que o middleware conseguiu do `/head`. */
export type ResultadoDoHead = { tipo: 'ok'; dados: DadosDoHead } | { tipo: 'sem-site' } | { tipo: 'falhou' };

export interface RespostaDaPagina {
  status: number;
  /** Endereço do 301. */
  location?: string;
  body?: string;
  cache: string;
  retryAfter?: string;
}

/** Cache da borda: o Google e a 2ª visita leem da Vercel, sem esperar o servidor. */
export const CACHE_DA_BORDA = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
const SEM_CACHE = 'no-store';
const CODIGOS = new Set([200, 404, 410, 503]);

/** `https://` no mesmo domínio: o único 301 que a borda aceita do servidor. */
function noMesmoDominio(url: string | null, dominio: string): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && limparHost(u.host) === limparHost(dominio);
  } catch {
    return false;
  }
}

/** Troca a query do endereço pela do pedido (UTM, gclid e fbclid sobrevivem ao 301). */
function comQuery(destino: string, search: string): string {
  const u = new URL(destino);
  u.search = search;
  return u.toString();
}

/**
 * Decide a resposta de uma página do site. Função pura (o middleware só busca).
 * Nesta ordem:
 * 1. o servidor falhou → 503 com `Retry-After` (o Google volta depois e não
 *    tira a página do índice), com o HTML cru para o visitante;
 * 2. não há site neste endereço → 404 `noindex`;
 * 3. endereço errado do site → 301 para o domínio oficial:
 *    - `exemplo.com.br` quando o oficial é `www.exemplo.com.br` (ou o contrário);
 *    - endereço antigo ou torto que o servidor corrigiu (`redirect`);
 *    - o mesmo site aberto pelo endereço lmflow (fora da prévia do editor);
 * 4. senão, o HTML com o `<head>`, o texto e o código que o servidor mandou
 *    (404 de verdade, 410 do vendido, 200).
 *
 * null = não mexe (o middleware deixa passar).
 */
/**
 * Trava do endereço lmflow: a resposta de antes do "site que ranqueia".
 * Falha ou site que não existe → null (segue pro app, como sempre); senão 200
 * com o head, ignorando o status do servidor. Única novidade: com domínio
 * próprio ATIVO, a página vai em 301 pro domínio (hoje nenhum cliente tem).
 */
function respostaDoSistema(html: string | null, h: string, url: URL, resultado: ResultadoDoHead): RespostaDaPagina | null {
  if (resultado.tipo !== 'ok') return null;
  const dados = resultado.dados;
  const dominio = texto(dados.domain);
  const canonical = texto(dados.canonical);
  const previa = url.searchParams.has('previa') || url.searchParams.has('modelo');
  const status = typeof dados.status === 'number' ? dados.status : 200;
  if (dominio && status === 200 && !previa && noMesmoDominio(canonical, dominio)) {
    return { status: 301, location: comQuery(canonical, url.search), cache: CACHE_DA_BORDA };
  }
  return html ? { status: 200, body: montarHead(html, dados, h), cache: CACHE_DA_BORDA } : null;
}

export function respostaDaPagina(
  html: string | null,
  host: string,
  url: URL,
  resultado: ResultadoDoHead,
): RespostaDaPagina | null {
  const h = limparHost(host);
  if (ehEnderecoDoSistema(h)) return respostaDoSistema(html, h, url, resultado);
  if (resultado.tipo === 'falhou') {
    return html ? { status: 503, body: html, cache: SEM_CACHE, retryAfter: '120' } : null;
  }
  if (resultado.tipo === 'sem-site') {
    return html ? { status: 404, body: montarHead(html, { robots: 'noindex' }, h), cache: CACHE_DA_BORDA } : null;
  }

  const dados = resultado.dados;
  const dominio = texto(dados.domain);
  const status = typeof dados.status === 'number' && CODIGOS.has(dados.status) ? dados.status : 200;

  if (dominio && limparHost(dominio) !== h) {
    return { status: 301, location: `https://${limparHost(dominio)}${url.pathname}${url.search}`, cache: CACHE_DA_BORDA };
  }
  const redirect = texto(dados.redirect);
  if (dominio && noMesmoDominio(redirect, dominio)) {
    return { status: 301, location: comQuery(redirect, url.search), cache: CACHE_DA_BORDA };
  }
  if (!html) return null;
  return {
    status,
    body: montarHead(html, dados, h),
    cache: status === 503 ? SEM_CACHE : CACHE_DA_BORDA,
    ...(status === 503 ? { retryAfter: '120' } : {}),
  };
}

/* ── sitemap.xml ──────────────────────────────────────────────────────────── */

/** Data no formato que o sitemap aceita (W3C: `2026-10-04` ou com hora). */
const DATA_W3C = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

/** Lista de URLs → `sitemap.xml`. Ignora o que não é endereço http(s). Máximo de 50.000 (limite do protocolo). */
export function sitemapXml(urls: UrlDoSitemap[]): string {
  const linhas = (Array.isArray(urls) ? urls : [])
    .filter(u => u && typeof u.loc === 'string' && /^https?:\/\//i.test(u.loc.trim()))
    .slice(0, 50000)
    .map(u => {
      const lastmod = texto(u.lastmod);
      const data = lastmod && DATA_W3C.test(lastmod) ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : '';
      return `  <url><loc>${escapeHtml(u.loc.trim())}</loc>${data}</url>`;
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...linhas,
    '</urlset>',
    '',
  ].join('\n');
}

/** O domínio ativo que veio na resposta do `/sitemap` (ou null). */
export function dominioDaResposta(json: unknown): string | null {
  const j = json as { domain?: unknown; data?: unknown } | null;
  const d = j && typeof j.data === 'object' && j.data && !Array.isArray(j.data) ? (j.data as { domain?: unknown }) : null;
  return texto(d?.domain) ?? texto(j?.domain);
}

/** Lê a resposta do `/sitemap`: `{ urls }`, `{ data: { urls } }` ou `{ data: [...] }`. */
export function urlsDaResposta(json: unknown): UrlDoSitemap[] | null {
  const j = json as { urls?: unknown; data?: unknown } | null;
  const d = j && typeof j.data === 'object' && j.data ? (j.data as { urls?: unknown }) : null;
  const lista = Array.isArray(j?.urls) ? j!.urls : Array.isArray(d) ? d : Array.isArray(d?.urls) ? d!.urls : null;
  return lista ? (lista as UrlDoSitemap[]) : null;
}

/** Lê a resposta do `/head`: o corpo puro ou envolto em `data`. */
export function dadosDaResposta(json: unknown): DadosDoHead | null {
  const j = json as Record<string, unknown> | null;
  if (!j || typeof j !== 'object') return null;
  const corpo = (typeof j.data === 'object' && j.data && !Array.isArray(j.data) ? j.data : j) as DadosDoHead;
  return texto(corpo.tenant) || texto(corpo.title) ? corpo : null;
}
