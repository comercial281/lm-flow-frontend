/**
 * Edge Middleware do Vercel: a landing de anúncio (/lp/*), o `<head>` das
 * páginas do site do cliente, o `robots.txt` e o `sitemap.xml` de cada endereço.
 *
 * LANDING (/lp/*)
 * Busca o conteúdo da landing na API DO LADO DO VERCEL (a um salto, com
 * conexão quente) e devolve o `lp.html` já com o conteúdo dentro e a foto de
 * capa pré-carregada — ver `src/features/landing/public/landingHtml.ts`. Para
 * o visitante, a página chega pronta: nenhuma ida à API antes da primeira
 * tela, e a capa (o LCP) começa a baixar junto com o código.
 * - endereço lmflow: `/lp/<cliente>/<slug>(/<resultado>)`;
 * - domínio do cliente: `/lp/<slug>(/obrigado|/desqualificado)`. O cliente vem
 *   do `resolve` do domínio, e o HTML leva também o `window.__LMF_SITE__`.
 *
 * PÁGINAS DO SITE
 * O site é um app de navegador, e o HTML cru é o do CRM ("LM Flow", noindex).
 * Aqui o `<head>` sai com o título, a descrição, a prévia do link (WhatsApp,
 * Google), o canonical e o robots do site — ver `middleware/headDoSite.ts`.
 * - endereço lmflow: `/portal/<cliente>/...` e `/imovel/<cliente>/<código>`;
 * - domínio do cliente: os caminhos limpos (`/`, `/imoveis`, `/imovel/<código>`,
 *   `/blog`, `/p/<slug>`…).
 * O resto (telas do CRM no endereço lmflow, arquivos, `/assets`) passa direto.
 *
 * A resposta é cacheada na borda por um minuto (`s-maxage`), então a página
 * vira, na prática, estática e se atualiza sozinha um minuto depois de publicada.
 *
 * QUANDO NÃO FAZ NADA
 * Qualquer tropeço (API fora, 404, sem variável de ambiente, HTML
 * inalcançável, tempo esgotado) deixa a requisição seguir para o rewrite de
 * sempre (`vercel.json`), e a página se vira sozinha como antes. O middleware
 * só ACELERA e arruma o `<head>`; nunca é o único caminho. O `index.html` cru é
 * `noindex`, então para robô a falha cai no fechado. No `robots.txt` a falha é
 * `Disallow: /`.
 *
 * ARMADILHAS
 * - O `matcher` NÃO cobre `/lp.html` nem `/index.html`: é este arquivo que busca
 *   os dois da própria implantação, e um matcher largo entraria em laço.
 * - O `matcher` não sabe o endereço: `/` e `/imoveis` também chegam aqui no
 *   app.lmflow.com.br. `paginaDoSite` devolve null para eles e nada é buscado.
 * - Sem `@vercel/edge`: o "segue em frente" é a resposta com o cabeçalho
 *   `x-middleware-next`, que é o que aquela biblioteca faz por baixo.
 * - Roda no runtime de borda (só APIs Web): nada de Node aqui, e os imports
 *   são relativos porque o apelido `@/` é do Vite, não deste empacotador.
 */
import { injectLandingIntoHtml, LANDING_DATA_MARKER } from './src/features/landing/public/landingHtml';
import { landingEndpoint, parseLandingPath, type PublicLandingDTO } from './src/features/landing/public/landingLoader';
import { ehEnderecoDoSistema, limparHost, rotaDaLandingNoDominio } from './src/features/siteBuilder/public/dominioDoSite';
import {
  dadosDaResposta,
  montarHead,
  paginaDoSite,
  robotsTxt,
  scriptDoSite,
  sitemapXml,
  urlsDaResposta,
  type DadosDoHead,
} from './middleware/headDoSite';

export const config = {
  matcher: [
    '/lp/:path*',
    '/robots.txt',
    '/sitemap.xml',
    // Páginas do site no domínio do cliente…
    '/',
    '/imoveis',
    '/imovel/:path*',
    '/blog',
    '/blog/:path*',
    '/p/:path*',
    '/financiamento',
    '/anuncie',
    // …e no endereço lmflow.
    '/portal/:path*',
  ],
};

/** Teto para a API responder. Acima disso a página se vira sozinha. */
const API_TIMEOUT_MS = 2500;

/** Navegador: sempre confere. Borda: um minuto, servindo o velho enquanto renova. */
const CACHE_DA_BORDA = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

const JSON_HEADERS = { Accept: 'application/json' };

const passThrough = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

function apiBase(): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const base = env?.VITE_API_URL;
  return base ? base.replace(/\/+$/, '') : null;
}

/** Roda `fn` com um sinal que aborta em `API_TIMEOUT_MS`. */
async function comPrazo<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = limparHost(url.hostname);
  if (url.pathname === '/robots.txt') return robots(host);
  if (url.pathname === '/sitemap.xml') return sitemap(host);
  if (url.pathname.startsWith('/lp/')) {
    return ehEnderecoDoSistema(host) ? landingNoLmflow(url) : landingNoDominio(url, host);
  }
  return pagina(url, host);
}

/* ── Landing ──────────────────────────────────────────────────────────────── */

function respostaDaLanding(html: string, tenant: string, slug: string, dto: PublicLandingDTO): Response {
  const body = injectLandingIntoHtml(html, { tenant, slug, dto });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Navegador: sempre confere (HTML muda com a publicação). Borda do
      // Vercel: um minuto, servindo o cache velho enquanto renova.
      'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
      'x-robots-tag': 'noindex',
      'x-lm-landing': 'inline',
    },
  });
}

/** `/lp/<cliente>/<slug>(/<resultado>)` no endereço lmflow. */
async function landingNoLmflow(url: URL): Promise<Response> {
  const route = parseLandingPath(url.pathname);
  const base = apiBase();
  if (!route || !base) return passThrough();
  try {
    return await comPrazo(async signal => {
      const [htmlRes, apiRes] = await Promise.all([
        fetch(new URL('/lp.html', url.origin).toString(), { signal }),
        fetch(landingEndpoint(base, route.slug), {
          headers: { 'X-Tenant': route.tenant, ...JSON_HEADERS },
          signal,
        }),
      ]);
      if (!htmlRes.ok || !apiRes.ok) return passThrough();

      const [html, json] = await Promise.all([htmlRes.text(), apiRes.json() as Promise<{ data?: PublicLandingDTO }>]);
      const dto = json?.data;
      if (!dto || !html) return passThrough();
      return respostaDaLanding(html, route.tenant, route.slug, dto);
    });
  } catch {
    return passThrough();
  }
}

/**
 * `/lp/<slug>(/obrigado|/desqualificado)` no domínio do cliente. O cliente vem
 * do `resolve` do domínio (em paralelo com o `lp.html`). O formato antigo
 * `/lp/<cliente>/<slug>` segue para a página, que redireciona para o limpo.
 */
async function landingNoDominio(url: URL, host: string): Promise<Response> {
  const rota = rotaDaLandingNoDominio(url.pathname);
  const base = apiBase();
  if (!rota || 'redirecionar' in rota || !base) return passThrough();
  try {
    return await comPrazo(async signal => {
      const [htmlRes, resolveRes] = await Promise.all([
        fetch(new URL('/lp.html', url.origin).toString(), { signal }),
        fetch(`${base}/api/public/v1/resolve?host=${encodeURIComponent(host)}`, { headers: JSON_HEADERS, signal }),
      ]);
      if (!htmlRes.ok || !resolveRes.ok) return passThrough();
      const site = dadosDaResposta(await resolveRes.json());
      const tenant = typeof site?.tenant === 'string' ? site.tenant.trim() : '';
      if (!tenant) return passThrough();

      const [html, apiRes] = await Promise.all([
        htmlRes.text(),
        fetch(landingEndpoint(base, rota.slug), { headers: { 'X-Tenant': tenant, ...JSON_HEADERS }, signal }),
      ]);
      if (!apiRes.ok) return passThrough();
      const json = (await apiRes.json()) as { data?: PublicLandingDTO };
      const dto = json?.data;
      if (!dto || !html) return passThrough();

      // O site do domínio vai junto: a página não pergunta o `resolve` de novo.
      const comSite = html.replace(LANDING_DATA_MARKER, `${scriptDoSite(tenant, site?.site_slug ?? null)}\n    ${LANDING_DATA_MARKER}`);
      return respostaDaLanding(comSite, tenant, rota.slug, dto);
    });
  } catch {
    return passThrough();
  }
}

/* ── Páginas do site ──────────────────────────────────────────────────────── */

function headEndpoint(base: string, host: string, path: string, tenant: string | null): string {
  const q = `host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`;
  return `${base}/api/public/v1/head?${q}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ''}`;
}

/** O `index.html` com o `<head>` do site. Em qualquer falha, o HTML de hoje. */
async function pagina(url: URL, host: string): Promise<Response> {
  const pg = paginaDoSite(host, url.pathname);
  const base = apiBase();
  if (!pg || !base) return passThrough();
  try {
    return await comPrazo(async signal => {
      const [htmlRes, apiRes] = await Promise.all([
        fetch(new URL('/index.html', url.origin).toString(), { signal }),
        fetch(headEndpoint(base, host, pg.path, pg.tenant), { headers: JSON_HEADERS, signal }),
      ]);
      if (!htmlRes.ok || !apiRes.ok) return passThrough();
      const [html, json] = await Promise.all([htmlRes.text(), apiRes.json()]);
      const dados = dadosDaResposta(json);
      if (!dados || !html) return passThrough();
      return new Response(montarHead(html, dados, host), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': CACHE_DA_BORDA,
          'x-lm-site': 'head',
        },
      });
    });
  } catch {
    return passThrough();
  }
}

/* ── robots.txt e sitemap.xml ─────────────────────────────────────────────── */

function resposta(body: string, status: number, contentType: string, cache: string): Response {
  return new Response(body, { status, headers: { 'content-type': contentType, 'cache-control': cache } });
}

/** `robots.txt` do endereço. Endereço do sistema nem pergunta: `Disallow: /`. */
async function robots(host: string): Promise<Response> {
  const base = apiBase();
  let dados: DadosDoHead | null = null;
  let falhou = false;
  if (!ehEnderecoDoSistema(host) && base) {
    try {
      dados = await comPrazo(async signal => {
        const res = await fetch(headEndpoint(base, host, '/', null), { headers: JSON_HEADERS, signal });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`head ${res.status}`);
        return dadosDaResposta(await res.json());
      });
    } catch {
      falhou = true;
    }
  }
  // A falha não fica guardada na borda: a próxima visita do robô pergunta de novo.
  return resposta(robotsTxt(host, dados), 200, 'text/plain; charset=utf-8', falhou ? 'no-store' : CACHE_DA_BORDA);
}

/** `sitemap.xml` do domínio. Endereço do sistema ou domínio sem site: 404. */
async function sitemap(host: string): Promise<Response> {
  const base = apiBase();
  const naoTem = () => resposta('Not found\n', 404, 'text/plain; charset=utf-8', CACHE_DA_BORDA);
  if (ehEnderecoDoSistema(host) || !base) return naoTem();
  try {
    return await comPrazo(async signal => {
      const res = await fetch(`${base}/api/public/v1/sitemap?host=${encodeURIComponent(host)}`, { headers: JSON_HEADERS, signal });
      if (res.status === 404) return naoTem();
      if (!res.ok) throw new Error(`sitemap ${res.status}`);
      const urls = urlsDaResposta(await res.json());
      if (!urls) throw new Error('sitemap sem lista');
      return resposta(sitemapXml(urls), 200, 'application/xml; charset=utf-8', CACHE_DA_BORDA);
    });
  } catch {
    // 503: o Google entende "volte depois" e não apaga o que já sabe do site.
    return resposta('Service unavailable\n', 503, 'text/plain; charset=utf-8', 'no-store');
  }
}
