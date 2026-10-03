// src/features/siteBuilder/public/siteTracking.ts
// Rastreamento do site público (Meu site · Rastreamento).
// REGRA DE HOST (não reabrir): GA4 e Pixel em qualquer endereço; GTM e Códigos
// avançados SÓ em domínio próprio. Em *.lmflow.com.br o site divide o endereço
// com o CRM, e a sessão de quem está logado fica no localStorage desse endereço:
// código de terceiro ali leria a sessão.
import { installPixel } from '@/features/landing/public/metaPixel';

export interface SiteTrackingConfig {
  tracking?: { gtm_id?: string | null; ga4?: string | null; facebook_pixel?: string | null } | null;
  custom_code?: { head?: string | null; body?: string | null } | null;
}

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; __lmfTracking?: boolean };

const NOT_OWN = [/(^|\.)lmflow\.com\.br$/i, /\.vercel\.app$/i, /^localhost$/i, /^127\.0\.0\.1$/];

export function isOwnDomain(host: string): boolean {
  const h = host.toLowerCase().split(':')[0];
  return !!h && !NOT_OWN.some(r => r.test(h));
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
    return s;
  });
  if (prepend) nodes.reverse().forEach(n => target.insertBefore(n, target.firstChild));
  else nodes.forEach(n => target.appendChild(n));
}

export function installSiteTracking(cfg: SiteTrackingConfig, deps: { win?: Window; host?: string } = {}): void {
  const w = (deps.win ?? window) as W;
  if (w.__lmfTracking) return;
  w.__lmfTracking = true;
  const doc = w.document;
  const host = deps.host ?? w.location.hostname;
  const t = cfg.tracking ?? {};

  try {
    if (t.ga4) {
      w.dataLayer = w.dataLayer || [];
      w.gtag = (...args: unknown[]) => { w.dataLayer!.push(args); };
      w.gtag('js', new Date());
      w.gtag('config', t.ga4, { send_page_view: false });
      addScript(doc, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.ga4)}`);
    }
    if (t.facebook_pixel) installPixel(t.facebook_pixel, { win: w, pageView: false });

    if (!isOwnDomain(host)) return;

    if (t.gtm_id) {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      addScript(doc, `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(t.gtm_id)}`);
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
