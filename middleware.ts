/**
 * Edge Middleware do Vercel para a landing de anúncio (/lp/*).
 *
 * O QUE FAZ
 * Busca o conteúdo da landing na API DO LADO DO VERCEL (a um salto, com
 * conexão quente) e devolve o `lp.html` já com o conteúdo dentro e a foto de
 * capa pré-carregada — ver `src/features/landing/public/landingHtml.ts`. Para
 * o visitante, a página chega pronta: nenhuma ida à API antes da primeira
 * tela, e a capa (o LCP) começa a baixar junto com o código.
 *
 * A resposta é cacheada na borda por um minuto (`s-maxage`), então a landing
 * vira, na prática, uma página estática que se atualiza sozinha um minuto
 * depois de publicada.
 *
 * QUANDO NÃO FAZ NADA
 * Qualquer tropeço (API fora, 404, sem variável de ambiente, `lp.html`
 * inalcançável, tempo esgotado) deixa a requisição seguir para o rewrite de
 * sempre (`vercel.json` → `lp.html` cru), e a página busca o conteúdo sozinha
 * como antes. O middleware só ACELERA; nunca é o único caminho.
 *
 * ARMADILHAS
 * - O `matcher` cobre `/lp/:path*` e NÃO `/lp.html`: é este arquivo que busca
 *   `/lp.html` da própria implantação, e um matcher largo entraria em laço.
 * - Sem `@vercel/edge`: o "segue em frente" é a resposta com o cabeçalho
 *   `x-middleware-next`, que é o que aquela biblioteca faz por baixo.
 * - Roda no runtime de borda (só APIs Web): nada de Node aqui, e os imports
 *   são relativos porque o apelido `@/` é do Vite, não deste empacotador.
 */
import { injectLandingIntoHtml } from './src/features/landing/public/landingHtml';
import { landingEndpoint, parseLandingPath, type PublicLandingDTO } from './src/features/landing/public/landingLoader';

export const config = { matcher: '/lp/:path*' };

/** Teto para a API responder. Acima disso a página se vira sozinha. */
const API_TIMEOUT_MS = 2500;

const passThrough = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

function apiBase(): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const base = env?.VITE_API_URL;
  return base ? base.replace(/\/+$/, '') : null;
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = parseLandingPath(url.pathname);
  const base = apiBase();
  if (!route || !base) return passThrough();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const [htmlRes, apiRes] = await Promise.all([
      fetch(new URL('/lp.html', url.origin).toString(), { signal: controller.signal }),
      fetch(landingEndpoint(base, route.slug), {
        headers: { 'X-Tenant': route.tenant, Accept: 'application/json' },
        signal: controller.signal,
      }),
    ]);
    if (!htmlRes.ok || !apiRes.ok) return passThrough();

    const [html, json] = await Promise.all([htmlRes.text(), apiRes.json() as Promise<{ data?: PublicLandingDTO }>]);
    const dto = json?.data;
    if (!dto || !html) return passThrough();

    const body = injectLandingIntoHtml(html, { tenant: route.tenant, slug: route.slug, dto });
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
  } catch {
    return passThrough();
  } finally {
    clearTimeout(timer);
  }
}
