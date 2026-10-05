// src/features/siteBuilder/public/siteTracking.ts
// Rastreamento do site público (Meu site · Rastreamento).
// REGRA DE HOST (não reabrir): GA4 e Pixel em qualquer endereço; GTM e Códigos
// avançados SÓ em domínio próprio. Em *.lmflow.com.br o site divide o endereço
// com o CRM, e a sessão de quem está logado fica no localStorage desse endereço:
// código de terceiro ali leria a sessão.
//
// Domínio próprio é uma lista POSITIVA: só o endereço que o servidor confirmou
// como domínio ativo do site (`dominioDoSite`). Endereço desconhecido, domínio
// ainda não verificado ou removido não é domínio próprio.
import { installPixel } from '@/features/landing/public/metaPixel';
import { dominioConfirmado, ehEnderecoDoSistema, limparHost } from './dominioDoSite';

export interface SiteTrackingConfig {
  tracking?: { gtm_id?: string | null; ga4?: string | null; facebook_pixel?: string | null } | null;
  custom_code?: { head?: string | null; body?: string | null } | null;
}

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; __lmfTracking?: boolean };

export function isOwnDomain(host: string): boolean {
  const h = limparHost(host);
  if (ehEnderecoDoSistema(h)) return false;
  const site = dominioConfirmado();
  return !!site && site.host === h;
}

// Valores antigos nunca passaram pela validação da tela: id fora do formato
// (ex.: um GTM colado no campo do GA4) é ignorado em vez de virar script.
const FORMATO = { ga4: /^G-[A-Z0-9]+$/, pixel: /^\d+$/, gtm: /^GTM-[A-Z0-9]+$/ };
function idValido(v: string | null | undefined, formato: RegExp): string | null {
  const n = (v ?? '').trim();
  return formato.test(n) ? n : null;
}

function addScript(doc: Document, src: string) {
  const s = doc.createElement('script');
  s.async = true;
  s.src = src;
  doc.head.appendChild(s);
}

// HTML colado pelo cliente: <script> criado por innerHTML não roda, então cada
// script é recriado. Só chamado em domínio próprio.
function injectHtml(doc: Document, html: string, target: HTMLElement, prepend: boolean) {
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  const nodes = Array.from(tpl.content.childNodes).map(node => {
    if (node.nodeName !== 'SCRIPT') return node;
    const old = node as HTMLScriptElement;
    const s = doc.createElement('script');
    Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
    s.text = old.text;
    if (old.src) s.async = false; // mantém a ordem colada pelo cliente
    return s;
  });
  if (prepend) nodes.reverse().forEach(n => target.insertBefore(n, target.firstChild));
  else nodes.forEach(n => target.appendChild(n));
}

export function installSiteTracking(cfg: SiteTrackingConfig, deps: { win?: Window; host?: string } = {}): void {
  const w = (deps.win ?? window) as W;
  if (w.__lmfTracking) return;
  const doc = w.document;
  const host = deps.host ?? w.location.hostname;
  const t = cfg.tracking ?? {};
  const ga4 = idValido(t.ga4, FORMATO.ga4);
  const pixel = idValido(t.facebook_pixel, FORMATO.pixel);
  const gtm = idValido(t.gtm_id, FORMATO.gtm);
  const own = isOwnDomain(host);
  const hasAdvanced = !!(gtm || cfg.custom_code?.head || cfg.custom_code?.body);
  // Config vazia (site que falhou ao carregar) não trava a instalação da próxima tentativa.
  if (!ga4 && !pixel && !(own && hasAdvanced)) return;
  w.__lmfTracking = true;

  try {
    if (ga4) {
      w.dataLayer = w.dataLayer || [];
      // gtag.js só entende `arguments` (não array) como comando.
      w.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      } as W['gtag'];
      w.gtag!('js', new Date());
      w.gtag!('config', ga4, { send_page_view: false });
      addScript(doc, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`);
    }
    if (pixel) installPixel(pixel, { win: w, pageView: false });

    if (!own) return;

    if (gtm) {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      addScript(doc, `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`);
    }
    if (cfg.custom_code?.head) injectHtml(doc, cfg.custom_code.head, doc.head, true);
    if (cfg.custom_code?.body) injectHtml(doc, cfg.custom_code.body, doc.body, true);
  } catch {
    // rastreamento nunca derruba o site
  }
}

export function trackPageView(path: string, deps: { win?: Window } = {}): void {
  const w = (deps.win ?? window) as W;
  try {
    w.gtag?.('event', 'page_view', { page_path: path, page_location: w.location.href });
    w.fbq?.('track', 'PageView');
  } catch { /* idem */ }
}

export function trackLead(deps: { win?: Window } = {}): void {
  const w = (deps.win ?? window) as W;
  try {
    w.gtag?.('event', 'generate_lead');
    w.fbq?.('track', 'Lead');
  } catch { /* idem */ }
}
