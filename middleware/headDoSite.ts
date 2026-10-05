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
  /** Nome do site, quando o servidor manda. Fora do contrato: só usado se vier. */
  site_name?: string | null;
  name?: string | null;
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

/** Caminhos limpos do site (sem `/lp`, que tem tratamento próprio). */
const LIMPOS = [
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

function ehLimpo(path: string): boolean {
  return LIMPOS.some(r => r.test(path));
}

/**
 * Lê o caminho e diz se é página do site:
 * - endereço do sistema: `/portal/<cliente>/<resto>` e `/imovel/<cliente>/<código>`
 *   (o resto do CRM, null: nada a fazer);
 * - domínio do cliente: os caminhos limpos (o resto o front manda para o início).
 */
export function paginaDoSite(host: string, pathname: string): PaginaDoSite | null {
  const partes = pathname.split('/').filter(Boolean).map(decodificar);
  if (ehEnderecoDoSistema(host)) {
    if (partes[0] === 'portal' && partes[1]) {
      const path = `/${partes.slice(2).join('/')}`;
      return ehLimpo(path) ? { tenant: partes[1], path } : null;
    }
    if (partes[0] === 'imovel' && partes.length === 3) {
      return { tenant: partes[1], path: `/imovel/${partes[2]}` };
    }
    return null;
  }
  const path = `/${partes.join('/')}`;
  return ehLimpo(path) ? { tenant: null, path } : null;
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
  const url = texto(dados.url) ?? canonical;
  const tags: string[] = [];
  if (!temTitulo) tags.push(`<title>${escapeHtml(tituloDaPagina)}</title>`);
  if (!META_ROBOTS.test(out)) tags.push(metaRobots);
  tags.push('<meta property="og:type" content="website" />');
  tags.push('<meta property="og:locale" content="pt_BR" />');
  if (titulo) tags.push(`<meta property="og:title" content="${escapeHtml(titulo)}" />`);
  if (descricao) tags.push(`<meta property="og:description" content="${escapeHtml(descricao)}" />`);
  if (imagem) tags.push(`<meta property="og:image" content="${escapeHtml(imagem)}" />`);
  if (url) tags.push(`<meta property="og:url" content="${escapeHtml(url)}" />`);
  tags.push(`<meta name="twitter:card" content="${imagem ? 'summary_large_image' : 'summary'}" />`);
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  if (dominio) tags.push(scriptDoSite(texto(dados.tenant)!, texto(dados.site_slug)));

  return out.replace('</head>', () => `    ${tags.join('\n    ')}\n  </head>`);
}

/* ── robots.txt ───────────────────────────────────────────────────────────── */

const ROBOTS_FECHADO = 'User-agent: *\nDisallow: /\n';

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
    'User-agent: *',
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
  return [
    'User-agent: *',
    'Allow: /$',
    'Allow: /imoveis',
    'Allow: /imovel/',
    'Allow: /blog',
    'Allow: /p/',
    'Allow: /financiamento',
    'Allow: /anuncie',
    'Allow: /assets/',
    'Allow: /favicon',
    'Disallow: /',
    '',
    `Sitemap: https://${h}/sitemap.xml`,
    '',
  ].join('\n');
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
