// src/features/siteBuilder/public/dominioDoSite.ts
// Domínio próprio do site (Meu site › Endereço do site).
//
// O mesmo build da Vercel atende o CRM (app.lmflow.com.br, *.lmflow.com.br) e o
// site do cliente no domínio dele (www.imobiliaria.com.br). Quem decide qual dos
// dois sobe é o ENDEREÇO, antes de montar qualquer coisa (ver src/main.tsx):
//
//   - endereço do sistema (lmflow, vercel.app, localhost, IP) → o app de sempre;
//   - qualquer outro → só o site, e só se o servidor confirmar que o domínio está
//     ativo (`window.__LMF_SITE__`, posto pelo middleware, ou o `resolve`).
//
// ARMADILHA: este arquivo é lido também pela entrada enxuta da landing
// (src/lp/main.tsx). Não importar nada daqui: nem React, nem serviço, nem o
// design system. Só `fetch` e a variável da API.

/** Site confirmado no domínio que está aberto. */
export interface SiteDoDominio {
  tenant: string;
  slug: string;
  /** Endereço confirmado (o da barra do navegador, sem porta e minúsculo). */
  host: string;
}

export type EstadoDoDominio =
  | { tipo: 'sistema' }
  | { tipo: 'site'; site: SiteDoDominio }
  /** O servidor disse que esse domínio não tem site ativo (404). */
  | { tipo: 'nao-encontrado' }
  /** Não deu para perguntar (rede, servidor fora). Não fica guardado: tenta de novo. */
  | { tipo: 'erro' };

declare global {
  interface Window {
    /** Posto no HTML pelo middleware da Vercel quando o domínio está ativo. */
    __LMF_SITE__?: { tenant?: unknown; slug?: unknown } | null;
  }
}

/** Host sem porta, sem ponto final e minúsculo. IPv6 (`[::1]`) fica com o colchete. */
export function limparHost(host: string): string {
  const h = (host || '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1 || undefined);
  return h.split(':')[0].replace(/\.+$/, '');
}

const DO_SISTEMA = [/(^|\.)lmflow\.com\.br$/, /\.vercel\.app$/, /^localhost$/, /\.localhost$/];

/**
 * Endereços que NUNCA são domínio de cliente: lmflow.com.br e subdomínios,
 * *.vercel.app, localhost e IP solto (v4 ou v6). Neles o app é o de sempre.
 */
export function ehEnderecoDoSistema(host: string): boolean {
  const h = limparHost(host);
  if (!h) return true;
  if (h.startsWith('[')) return true; // IPv6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // IPv4
  return DO_SISTEMA.some(r => r.test(h));
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/* ── Guardado em memória: uma pergunta por carga de página ─────────────────── */
let pergunta: Promise<EstadoDoDominio> | null = null;
let confirmado: SiteDoDominio | null = null;

/** Só para teste: esquece o que foi perguntado. */
export function esquecerDominio(): void {
  pergunta = null;
  confirmado = null;
}

/**
 * O site confirmado neste endereço, ou null (endereço do sistema, domínio sem
 * site, ou ainda não perguntado). Síncrono: o rastreamento usa isto para saber
 * se está em domínio próprio.
 */
export function dominioConfirmado(): SiteDoDominio | null {
  return confirmado;
}

interface Deps {
  win?: Pick<Window, '__LMF_SITE__'> & { location: Pick<Location, 'hostname'> };
  fetchFn?: typeof fetch;
  api?: string;
}

async function perguntar(host: string, deps: Deps): Promise<EstadoDoDominio> {
  const api = (deps.api ?? (import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');
  try {
    const res = await (deps.fetchFn ?? fetch)(`${api}/api/public/v1/resolve?host=${encodeURIComponent(host)}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) return { tipo: 'nao-encontrado' };
    if (!res.ok) return { tipo: 'erro' };
    const json = (await res.json()) as Record<string, unknown> | null;
    const corpo = (json && typeof json.data === 'object' && json.data ? json.data : json) as Record<string, unknown> | null;
    const tenant = texto(corpo?.tenant);
    if (!tenant) return { tipo: 'nao-encontrado' };
    return { tipo: 'site', site: { tenant, slug: texto(corpo?.site_slug) ?? tenant, host } };
  } catch {
    return { tipo: 'erro' };
  }
}

/**
 * Que site este endereço mostra. Endereço do sistema responde na hora; senão lê
 * `window.__LMF_SITE__` e, só se ele não existir, pergunta ao servidor UMA vez
 * (`GET /api/public/v1/resolve?host=`). O "não encontrado" fica guardado; o erro
 * de rede não (a próxima chamada pergunta de novo).
 */
export function dominioDoSite(deps: Deps = {}): Promise<EstadoDoDominio> {
  if (pergunta) return pergunta;
  const win = deps.win ?? (typeof window !== 'undefined' ? window : undefined);
  const host = limparHost(win?.location.hostname ?? '');
  if (ehEnderecoDoSistema(host)) return Promise.resolve({ tipo: 'sistema' });

  const injetado = win?.__LMF_SITE__;
  const tenantInjetado = texto(injetado?.tenant);
  if (tenantInjetado) {
    confirmado = { tenant: tenantInjetado, slug: texto(injetado?.slug) ?? tenantInjetado, host };
    pergunta = Promise.resolve({ tipo: 'site', site: confirmado });
    return pergunta;
  }

  const atual = perguntar(host, deps).then(estado => {
    if (estado.tipo === 'site') confirmado = estado.site;
    if (estado.tipo === 'erro' && pergunta === atual) pergunta = null;
    return estado;
  });
  pergunta = atual;
  return atual;
}

/* ── Caminhos do site ─────────────────────────────────────────────────────── */

/** Onde o site está aberto: no domínio do cliente ou no endereço lmflow. */
export interface CtxDoSite {
  tenant: string;
  /** true = domínio do cliente (caminhos limpos). */
  dominio: boolean;
}

/**
 * Endereço de uma página do site. `rota` é sempre o caminho LIMPO (o do
 * domínio), com busca e âncora se houver: `/`, `/imoveis?tab=rent`,
 * `/imovel/AP01`, `/blog`, `/blog/<slug>`, `/p/<slug>`, `/financiamento`,
 * `/anuncie`, `/lp/<slug>`, `/#contato`.
 *
 * No domínio do cliente devolve a própria rota. No endereço lmflow:
 * `/portal/<tenant>/...`, `/imovel/<tenant>/<código>` ou `/lp/<tenant>/<slug>`.
 */
export function caminhoDoSite(ctx: CtxDoSite, rota: string): string {
  const r = rota.startsWith('/') ? rota : `/${rota}`;
  if (ctx.dominio) return r;
  const corte = r.search(/[?#]/);
  const caminho = corte === -1 ? r : r.slice(0, corte);
  const resto = corte === -1 ? '' : r.slice(corte);
  const t = encodeURIComponent(ctx.tenant);
  if (caminho === '/') return `/portal/${t}${resto}`;
  if (caminho.startsWith('/imovel/')) return `/imovel/${t}/${caminho.slice('/imovel/'.length)}${resto}`;
  if (caminho.startsWith('/lp/')) return `/lp/${t}/${caminho.slice('/lp/'.length)}${resto}`;
  return `/portal/${t}${caminho}${resto}`;
}

/* ── Landing de anúncio no domínio ────────────────────────────────────────── */

const RESULTADOS = new Set(['obrigado', 'desqualificado']);

export type RotaDaLanding =
  | { slug: string; result?: string }
  | { redirecionar: string };

/**
 * No domínio a landing é `/lp/<slug>` e o resultado `/lp/<slug>/obrigado` (ou
 * `/desqualificado`). O formato antigo `/lp/<tenant>/<slug>` (link de anúncio
 * colado no domínio) vai para o limpo. Fora disso, null.
 */
export function rotaDaLandingNoDominio(pathname: string): RotaDaLanding | null {
  const m = pathname.match(/^\/lp\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const dec = (s: string) => {
    try { return decodeURIComponent(s); } catch { return s; }
  };
  const [, a, b, c] = m;
  if (!b) return { slug: dec(a) };
  if (!c && RESULTADOS.has(dec(b))) return { slug: dec(a), result: dec(b) };
  // /lp/<tenant>/<slug>(/<resultado>): o tenant é o do domínio, sempre.
  if (c && !RESULTADOS.has(dec(c))) return null;
  return { redirecionar: `/lp/${b}${c ? `/${c}` : ''}` };
}
