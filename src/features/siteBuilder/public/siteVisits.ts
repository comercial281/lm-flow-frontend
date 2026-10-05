// src/features/siteBuilder/public/siteVisits.ts
// Contador de visitas do Meu site. Id do visitante aleatório no próprio site
// (sem dado pessoal, sem cookie de terceiro). A origem é a da 1ª tela da sessão.
import { cabecalhosDoSite } from './previa';

export type VisitKind = 'home' | 'search' | 'property' | 'page' | 'blog' | 'article' | 'financing' | 'listing' | 'landing';
export interface VisitInput { kind: VisitKind; path: string; propertyCode?: string; pageSlug?: string }

const VID = 'lmf_vid';
const SRC = 'lmf_src';
let memoriaVid: string | null = null;

function novoId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

function ler(storage: Storage | null, k: string): string | null {
  try { return storage?.getItem(k) ?? null; } catch { return null; }
}
function gravar(storage: Storage | null, k: string, v: string): void {
  try { storage?.setItem(k, v); } catch { /* bloqueado: segue sem gravar */ }
}

export function getVisitorId(storage: Storage | null): string {
  const salvo = ler(storage, VID);
  if (salvo) return salvo;
  const id = memoriaVid ?? novoId();
  memoriaVid = id;
  gravar(storage, VID, id);
  return id;
}

export function sessionSource(storage: Storage | null, loc: { search: string }, referrer: string) {
  const salvo = ler(storage, SRC);
  if (salvo) {
    try { return { ...JSON.parse(salvo), entry: false }; } catch { /* refaz */ }
  }
  const q = new URLSearchParams(loc.search);
  const src = {
    referrer,
    utm_source: q.get('utm_source') ?? undefined,
    utm_medium: q.get('utm_medium') ?? undefined,
    utm_campaign: q.get('utm_campaign') ?? undefined,
    gclid: q.has('gclid'),
  };
  gravar(storage, SRC, JSON.stringify(src));
  return { ...src, entry: true };
}

export function sendSiteVisit(input: VisitInput, ctx: {
  api: string; tenant: string; fetchFn?: typeof fetch; local?: Storage | null; session?: Storage | null;
  loc?: { search: string }; referrer?: string; host?: string;
}): void {
  try {
    const local = ctx.local !== undefined ? ctx.local : safeStorage('localStorage');
    const session = ctx.session !== undefined ? ctx.session : safeStorage('sessionStorage');
    const src = sessionSource(session, ctx.loc ?? window.location, ctx.referrer ?? document.referrer);
    const visit = {
      kind: input.kind, path: input.path, property_code: input.propertyCode, page_slug: input.pageSlug,
      visitor_id: getVisitorId(local), ...src,
      // O servidor usa o host do próprio site para não contar a navegação interna como origem.
      site_host: ctx.host ?? window.location.hostname,
    };
    const f = ctx.fetchFn ?? fetch;
    void f(`${ctx.api}/api/public/v1/site/visits`, {
      // Sem keepalive: numa SPA a página não fecha no meio do envio, e keepalive
      // + preflight de CORS falha calado em alguns navegadores.
      method: 'POST',
      headers: cabecalhosDoSite(ctx.tenant, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ visit }),
    }).catch(() => undefined);
  } catch { /* contador nunca derruba o site */ }
}

function safeStorage(nome: 'localStorage' | 'sessionStorage'): Storage | null {
  try { return window[nome]; } catch { return null; }
}
