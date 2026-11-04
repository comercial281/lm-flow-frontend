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
 * Aqui sai a página que o Google lê como site normal — ver `middleware/headDoSite.ts`:
 * o `<head>` (título, descrição, prévia do link, canonical, robots, JSON-LD), o
 * TEXTO da página dentro do HTML (`#lmf-ssr`, que o app troca quando monta) e o
 * código certo: 200, 301 (www ↔ sem www, endereço lmflow → domínio, endereço
 * legível do imóvel), 404 de verdade, 410 do imóvel vendido, 503 se o servidor cair.
 * - endereço lmflow: `/portal/<cliente>/...` e `/imovel/<cliente>/<código>`;
 * - domínio do cliente: qualquer caminho, menos `/lp` (o servidor diz se existe).
 * O resto (telas do CRM no endereço lmflow, arquivos, `/assets`) passa direto.
 *
 * ROBOTS.TXT, SITEMAP.XML E LLMS.TXT
 * - domínio do cliente: abre o site com o Google ligado (e os robôs de IA);
 * - subdomínio do cliente (`imob.lmflow.com.br`), sem domínio próprio ativo:
 *   abre só `/portal/imob` e `/imovel/imob/` com o Google ligado;
 * - `app`, `www`, `api`, `admin` e o resto do sistema: `Disallow: /`.
 *
 * A resposta é cacheada na borda por um minuto (`s-maxage`), então a página
 * vira, na prática, estática e se atualiza sozinha um minuto depois de publicada.
 *
 * QUANDO O SERVIDOR FALHA
 * - endereço lmflow: segue para o rewrite de sempre (`vercel.json`), como antes;
 * - domínio do cliente: 503 com `Retry-After` e o HTML do app (o visitante vê o
 *   site normal; o Google volta depois e NÃO tira a página do índice — 200 com
 *   noindex tiraria). Sem variável de ambiente ou sem o `index.html`: segue direto.
 * - `robots.txt`: `Disallow: /` sem guardar na borda.
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
  CACHE_DA_BORDA,
  caminhoLimpo,
  dadosDaResposta,
  dominioDaResposta,
  llmsTxt,
  paginaDoSite,
  respostaDaPagina,
  robotsTxt,
  scriptDoSite,
  sitemapXml,
  subdominioDoCliente,
  urlsDaResposta,
  type DadosDoHead,
  type PaginaDoSite,
  type ResultadoDoHead,
} from './middleware/headDoSite';

export const config = {
  matcher: [
    '/lp/:path*',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    // Toda página (no domínio do cliente, qualquer endereço é do site; quem diz
    // se ela existe é o servidor). Fora: arquivos com extensão (inclui o
    // `/index.html` e o `/lp.html` que este arquivo busca — laço), `/assets`,
    // `/api` e o `_vercel`.
    '/((?!assets/|api/|_vercel|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};

/** Teto para a API da landing e do sitemap responder. Acima disso a página se vira sozinha. */
const API_TIMEOUT_MS = 2500;

/**
 * Teto do `head` (páginas do site e `robots.txt`). A borda guarda a resposta
 * pronta por um minuto, então só a 1ª visita de cada página paga a espera;
 * acima dela, no domínio, sai 503 (o Google volta depois) com a página de hoje.
 */
const HEAD_TIMEOUT_MS = 3000;

const JSON_HEADERS = { Accept: 'application/json' };

const passThrough = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

function apiBase(): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const base = env?.VITE_API_URL;
  return base ? base.replace(/\/+$/, '') : null;
}

/** Roda `fn` com um sinal que aborta em `ms` (padrão `API_TIMEOUT_MS`). */
async function comPrazo<T>(fn: (signal: AbortSignal) => Promise<T>, ms = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
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
  if (url.pathname === '/llms.txt') return llms(host);
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
      const comSite = html.replace(LANDING_DATA_MARKER, () => `${scriptDoSite(tenant, site?.site_slug ?? null)}\n    ${LANDING_DATA_MARKER}`);
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

/** O `index.html` da própria implantação (sem cache próprio: a borda já guarda a resposta pronta). */
async function htmlDoApp(url: URL): Promise<string | null> {
  try {
    return await comPrazo(async signal => {
      const res = await fetch(new URL('/index.html', url.origin).toString(), { signal });
      return res.ok ? await res.text() : null;
    }, HEAD_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/** Pergunta o `/head`: 404 = não há site neste endereço; erro, tempo ou resposta torta = falhou. */
async function headDaPagina(base: string, host: string, pg: PaginaDoSite): Promise<ResultadoDoHead> {
  try {
    return await comPrazo(async signal => {
      const res = await fetch(headEndpoint(base, host, pg.path, pg.tenant), { headers: JSON_HEADERS, signal });
      if (res.status === 404) return { tipo: 'sem-site' } as const;
      if (!res.ok) return { tipo: 'falhou' } as const;
      const dados = dadosDaResposta(await res.json());
      return dados ? ({ tipo: 'ok', dados } as const) : ({ tipo: 'falhou' } as const);
    }, HEAD_TIMEOUT_MS);
  } catch {
    return { tipo: 'falhou' };
  }
}

/**
 * Página do site: o `index.html` com o `<head>`, o texto da página e o código
 * de resposta certo (200, 301, 404, 410, 503) — a regra mora em
 * `respostaDaPagina`. Endereço do sistema fora do site (telas do CRM) passa
 * direto, sem perguntar nada.
 */
async function pagina(url: URL, host: string): Promise<Response> {
  const pg = paginaDoSite(host, url.pathname);
  const base = apiBase();
  if (!pg || !base) return passThrough();
  const limpo = ehEnderecoDoSistema(host) ? null : caminhoLimpo(url.pathname);
  if (limpo) {
    return new Response(null, {
      status: 301,
      headers: { location: `${limpo}${url.search}`, 'cache-control': CACHE_DA_BORDA, 'x-lm-site': 'head' },
    });
  }
  const [html, resultado] = await Promise.all([htmlDoApp(url), headDaPagina(base, host, pg)]);
  // No endereço lmflow, servidor fora não vira 503: lá a página é do CRM também.
  if (resultado.tipo !== 'ok' && ehEnderecoDoSistema(host)) return passThrough();
  const r = respostaDaPagina(html, host, url, resultado);
  if (!r) return passThrough();
  const headers: Record<string, string> = { 'cache-control': r.cache, 'x-lm-site': 'head' };
  if (r.location) headers.location = r.location;
  if (r.retryAfter) headers['retry-after'] = r.retryAfter;
  if (r.body != null) headers['content-type'] = 'text/html; charset=utf-8';
  return new Response(r.body ?? null, { status: r.status, headers });
}

/** `llms.txt` do domínio do cliente (resumo do site para as IAs). Sem site ou Google desligado: 404. */
async function llms(host: string): Promise<Response> {
  const base = apiBase();
  const naoTem = () => resposta('Not found\n', 404, 'text/plain; charset=utf-8', CACHE_DA_BORDA);
  if (ehEnderecoDoSistema(host) || !base) return naoTem();
  const r = await headDaPagina(base, host, { tenant: null, path: '/' });
  if (r.tipo === 'falhou') return resposta('Service unavailable\n', 503, 'text/plain; charset=utf-8', 'no-store');
  const corpo = r.tipo === 'ok' ? llmsTxt(host, r.dados) : null;
  return corpo ? resposta(corpo, 200, 'text/plain; charset=utf-8', CACHE_DA_BORDA) : naoTem();
}

/* ── robots.txt e sitemap.xml ─────────────────────────────────────────────── */

function resposta(body: string, status: number, contentType: string, cache: string): Response {
  return new Response(body, { status, headers: { 'content-type': contentType, 'cache-control': cache } });
}

/**
 * `robots.txt` do endereço. Endereço do sistema (app, www, api, admin…) nem
 * pergunta: `Disallow: /`. Domínio do cliente pergunta o `head` do `/`; o
 * subdomínio do cliente (`imob.lmflow.com.br`), o do `/portal/imob`.
 */
async function robots(host: string): Promise<Response> {
  const base = apiBase();
  const slug = subdominioDoCliente(host);
  let dados: DadosDoHead | null = null;
  let falhou = false;
  if ((slug || !ehEnderecoDoSistema(host)) && base) {
    const endpoint = slug ? headEndpoint(base, host, `/portal/${slug}`, slug) : headEndpoint(base, host, '/', null);
    try {
      dados = await comPrazo(async signal => {
        const res = await fetch(endpoint, { headers: JSON_HEADERS, signal });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`head ${res.status}`);
        return dadosDaResposta(await res.json());
      }, HEAD_TIMEOUT_MS);
    } catch {
      falhou = true;
    }
  }
  // A falha não fica guardada na borda: a próxima visita do robô pergunta de novo.
  return resposta(robotsTxt(host, dados), 200, 'text/plain; charset=utf-8', falhou ? 'no-store' : CACHE_DA_BORDA);
}

/**
 * `sitemap.xml` do domínio do cliente ou do subdomínio do cliente
 * (`imob.lmflow.com.br`). Endereço do sistema ou sem site: 404. No subdomínio
 * de um site que tem domínio ativo, também 404: o sitemap mora no domínio.
 */
async function sitemap(host: string): Promise<Response> {
  const base = apiBase();
  const slug = subdominioDoCliente(host);
  const naoTem = () => resposta('Not found\n', 404, 'text/plain; charset=utf-8', CACHE_DA_BORDA);
  if ((!slug && ehEnderecoDoSistema(host)) || !base) return naoTem();
  const q = `host=${encodeURIComponent(host)}${slug ? `&tenant=${encodeURIComponent(slug)}` : ''}`;
  try {
    return await comPrazo(async signal => {
      const res = await fetch(`${base}/api/public/v1/sitemap?${q}`, { headers: JSON_HEADERS, signal });
      if (res.status === 404) return naoTem();
      if (!res.ok) throw new Error(`sitemap ${res.status}`);
      const json = await res.json();
      if (slug && dominioDaResposta(json)) return naoTem();
      const urls = urlsDaResposta(json);
      if (!urls) throw new Error('sitemap sem lista');
      return resposta(sitemapXml(urls), 200, 'application/xml; charset=utf-8', CACHE_DA_BORDA);
    });
  } catch {
    // 503: o Google entende "volte depois" e não apaga o que já sabe do site.
    return resposta('Service unavailable\n', 503, 'text/plain; charset=utf-8', 'no-store');
  }
}
