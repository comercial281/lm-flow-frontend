import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllPortalProperties } from './portalProperties';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — peças compartilhadas (Produto A do LM Flow)
   Tipos, utilitários, ícones, componentes e o hook de dados usados tanto pela
   home (PortalHomePage) quanto pela página dedicada de busca (PortalSearchPage).
   TUDO é dirigido pelos tokens de marca do cliente (logo, cores, fonte,
   WhatsApp). Zero marca hardcoded.
──────────────────────────────────────────────────────────────────────────── */

/* ── Tipos ───────────────────────────────────────────────────────────────── */
export interface Branding {
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
}
/** Banco na página de financiamento. O servidor só manda os que têm link. */
export interface PortalBank {
  key: string;
  name: string;
  color: string;
  ink?: string | null;
  url?: string | null;
  logo_url?: string | null;
}
export interface PortalFinancing {
  enabled?: boolean;
  title?: string;
  intro?: string;
  footer?: string;
  banks?: PortalBank[];
}
export interface PortalListing {
  enabled?: boolean;
  title?: string;
  intro?: string;
  whatsapp_text?: string;
  thanks_title?: string;
  thanks_text?: string;
  /* Os e-mails de destino NÃO chegam aqui, de propósito: o endereço do portal é
     aberto e servi-los entregaria o e-mail do dono a qualquer robô coletor. */
}
export interface SiteInfo {
  name?: string;
  branding?: Branding;
  /** Banner da home: vídeo tem prioridade; sem os dois, a capa do primeiro imóvel. */
  hero?: { video_url?: string | null; image_url?: string | null };
  sections?: { stats?: boolean; lead_capture?: boolean };
  contact?: { whatsapp?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  social_links?: Record<string, string> | null;
  seo?: { title?: string | null; description?: string | null };
  /** Página *Simule seu financiamento* (Site Builder). Ausente = desligada. */
  financiamento?: PortalFinancing | null;
  /** Página *Anuncie seu imóvel* (Site Builder). Ausente = desligada. */
  anuncie?: PortalListing | null;
}
export interface PortalProperty {
  id: string;
  code: string;
  title: string;
  transaction_type: string;
  property_type: string;
  display_price?: string;
  icon_summary?: { bedrooms?: number; bathrooms?: number; suites?: number; parking?: number; useful_area_m2?: number };
  address?: { city?: string; neighborhood?: string };
  cover_url?: string | null;
  featured?: boolean;
  exclusive?: boolean;
}

/* Artigo do blog público (item da listagem). */
export interface PortalArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  views_count?: number | null;
  category_id?: number | null;
}
/* Artigo completo (detalhe) — inclui o corpo em HTML já renderizado. */
export type PortalArticleFull = PortalArticleSummary & { body_html?: string | null };

/* Aba de transação usada na busca. `launch` = lançamentos. */
export type PortalTab = 'sale' | 'rent' | 'launch';

/* Filtros aplicados na busca (dirigidos pela URL na página de busca). */
export interface PortalFilters {
  tab: PortalTab;
  type: string;
  city: string;
  neighborhood: string;
  bedrooms: string;
  code: string;
}

export const API = import.meta.env.VITE_API_URL as string;

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: 'Apartamento', house: 'Casa', condo: 'Casa em condomínio',
  land: 'Terreno', commercial: 'Comercial', studio: 'Studio', farm: 'Chácara',
};

export function onlyDigits(s?: string | null) { return (s || '').replace(/\D/g, ''); }

/* ── SVG icons (inline, sem dependência) ─────────────────────────────────── */
export const I = {
  bed: 'M2 17v-5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v4M2 21v-4M22 21v-6M2 12V7m4 3V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2',
  bath: 'M4 12V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 21l-1 1M18 21l1 1',
  car: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 15h12M3 15l1.5-5A2 2 0 0 1 6.4 8.6h9.2a2 2 0 0 1 1.9 1.4L19 15',
  ruler: 'M3 3h4v4M3 3l7 7M21 21h-4v-4M21 21l-7-7M3 21v-4M3 21h4M21 3h-4M21 3v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  wa: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.2 1.2-1.7 1.2-.9.1-1 .4-3.6-.9-2.6-1.4-4.1-4.1-4.2-4.3-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2 1.3 2.3 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z',
  menu: 'M3 6h18M3 12h18M3 18h18', close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
  bank: 'M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8M10 10v8M14 10v8M18 10v8',
  sign: 'M4 3v18M4 5h13l-2.5 3L17 11H4',
};
export function Ic({ d, s = 18, cls = '' }: { d: string; s?: number; cls?: string }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={cls}><path d={d} /></svg>;
}

/* ── Filtro de imóveis (puro, reutilizável) ──────────────────────────────── */
export function filterProperties(items: PortalProperty[], f: PortalFilters): PortalProperty[] {
  return items.filter(p => {
    if (f.tab === 'rent' && p.transaction_type !== 'rent') return false;
    if (f.tab === 'sale' && p.transaction_type === 'rent') return false;
    // "Lançamentos" ainda não tem campo próprio no backend — usamos `featured`
    // como proxy interino até existir um flag de lançamento.
    if (f.tab === 'launch' && !p.featured) return false;
    if (f.type && p.property_type !== f.type) return false;
    if (f.city && p.address?.city !== f.city) return false;
    if (f.neighborhood && p.address?.neighborhood !== f.neighborhood) return false;
    if (f.bedrooms && (p.icon_summary?.bedrooms ?? 0) < Number(f.bedrooms)) return false;
    if (f.code && !p.code.toLowerCase().includes(f.code.toLowerCase())) return false;
    return true;
  });
}

/* ── Hook de dados do portal (site + imóveis + tokens derivados) ──────────── */
export function usePortalData(tenant?: string) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [site, setSite] = useState<SiteInfo>({});
  const [items, setItems] = useState<PortalProperty[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant) return;
      try {
        // O catálogo vem INTEIRO (todas as páginas), nunca uma página só: o
        // portal filtra no navegador e monta cidade/bairro do que carregou.
        // Ver portalProperties.ts — foi uma página de 60 que fez um cliente
        // com 390 imóveis publicados ver 60 no site.
        const [siteRes, propsJson] = await Promise.all([
          fetch(`${API}/api/public/v1/site`, { headers: { 'X-Tenant': tenant } }),
          fetchAllPortalProperties(API, tenant),
        ]);
        if (!active) return;
        const siteJson = siteRes.ok ? ((await siteRes.json()).data as SiteInfo) : {};
        setSite(siteJson || {});
        setItems(propsJson || []);
        document.title = siteJson?.seo?.title || `${siteJson?.name || 'Imóveis'} — Encontre seu imóvel`;
        const meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]') || (() => {
          const m = document.createElement('meta'); m.name = 'robots'; document.head.appendChild(m); return m;
        })();
        meta.content = 'index,follow';
        setState('ok');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => { active = false; };
  }, [tenant]);

  const brand = site.branding?.primary_color || '#0E7C5A';
  const accent = site.branding?.accent_color || brand;
  const font = site.branding?.font_family || 'Inter';
  const fontPrimary = font.split(',')[0].trim();
  const fontStack = font.includes(',') ? font : `${font}, system-ui, sans-serif`;
  const fontHref = `https://fonts.googleapis.com/css2?family=${fontPrimary.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  const wa = site.contact?.whatsapp;

  const cities = useMemo(() => [...new Set(items.map(i => i.address?.city).filter(Boolean) as string[])].sort(), [items]);
  const hoods = useMemo(() => [...new Set(items.map(i => i.address?.neighborhood).filter(Boolean) as string[])].sort(), [items]);
  const types = useMemo(() => [...new Set(items.map(i => i.property_type).filter(Boolean))], [items]);

  const cssVars = {
    ['--brand' as string]: brand,
    ['--accent' as string]: accent,
    ['--ink' as string]: '#17140F',
    ['--paper' as string]: '#FAF7F2',
    ['--display' as string]: fontStack,
    fontFamily: fontStack,
  } as CSSProperties;

  return { state, site, items, brand, accent, font, fontStack, fontHref, wa, cities, hoods, types, cssVars };
}

/* ── Blog: fetch de artigos (mesmo padrão público, header X-Tenant) ───────── */
export async function fetchArticles(
  tenant: string, page = 1, perPage = 12,
): Promise<{ data: PortalArticleSummary[]; total: number }> {
  const res = await fetch(
    `${API}/api/public/v1/site/articles?page=${page}&per_page=${perPage}`,
    { headers: { 'X-Tenant': tenant } },
  );
  if (!res.ok) return { data: [], total: 0 };
  const json = await res.json();
  return { data: (json.data as PortalArticleSummary[]) || [], total: json.meta?.total ?? 0 };
}

export async function fetchArticle(tenant: string, slug: string): Promise<PortalArticleFull | null> {
  const res = await fetch(
    `${API}/api/public/v1/site/articles/${encodeURIComponent(slug)}`,
    { headers: { 'X-Tenant': tenant } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data as PortalArticleFull) || null;
}

/**
 * Checagem leve p/ decidir se o link "Blog" aparece no menu: só há blog se
 * existe ao menos um artigo publicado. Uma requisição por montagem do header.
 */
export function usePublishedArticlesExist(tenant?: string): boolean {
  const [exists, setExists] = useState(false);
  useEffect(() => {
    let active = true;
    if (!tenant) return;
    fetchArticles(tenant, 1, 1)
      .then(r => { if (active) setExists(r.total > 0); })
      .catch(() => { /* silencioso: na dúvida, não mostra o link */ });
    return () => { active = false; };
  }, [tenant]);
  return exists;
}

/* ── Card de imóvel ──────────────────────────────────────────────────────── */
export function PropertyCard({ tenant, p, wa }: { tenant: string; p: PortalProperty; wa?: string | null }) {
  const s = p.icon_summary ?? {};
  const badge = p.exclusive ? 'Exclusivo' : (p.featured ? 'Destaque' : null);
  const typeLabel = PROPERTY_TYPE_LABEL[p.property_type] || p.property_type;
  const local = [p.address?.neighborhood, p.address?.city].filter(Boolean).join(', ');
  const waLink = wa ? `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${p.code} (${p.title}).`)}` : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.25)]">
      <Link to={`/imovel/${tenant}/${p.code}`} className="relative block aspect-[4/3] overflow-hidden bg-neutral-100">
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Ic d={I.pin} s={40} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {badge && (
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white" style={{ background: 'var(--brand)' }}>
            {badge}
          </span>
        )}
        {p.display_price && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3.5 py-1.5 text-[15px] font-bold text-[var(--ink)] shadow-sm backdrop-blur">
            {p.display_price}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">{typeLabel}</span>
        <Link to={`/imovel/${tenant}/${p.code}`} className="mt-1">
          <h3 className="font-[var(--display)] text-[17px] leading-snug text-[var(--ink)] line-clamp-2 transition-colors group-hover:text-[var(--brand)]">{p.title}</h3>
        </Link>
        {local && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-500">
            <Ic d={I.pin} s={13} /> {local}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-neutral-600">
          {!!s.bedrooms && <span className="inline-flex items-center gap-1.5"><Ic d={I.bed} s={15} /> {s.bedrooms}</span>}
          {!!s.suites && <span className="inline-flex items-center gap-1.5"><Ic d={I.bath} s={15} /> {s.suites} suíte{s.suites > 1 ? 's' : ''}</span>}
          {!!s.parking && <span className="inline-flex items-center gap-1.5"><Ic d={I.car} s={15} /> {s.parking}</span>}
          {!!s.useful_area_m2 && <span className="inline-flex items-center gap-1.5"><Ic d={I.ruler} s={15} /> {s.useful_area_m2} m²</span>}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-black/[0.06] pt-3">
          <Link to={`/imovel/${tenant}/${p.code}`} className="flex-1 rounded-full px-3 py-2 text-center text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--ink)' }}>
            Ver detalhes
          </Link>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105">
              <Ic d={I.wa} s={18} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Select e Stat ───────────────────────────────────────────────────────── */
export function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-3.5 py-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">{label}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </div>
  );
}
export function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-[var(--display)] text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{n}</div>
      <div className="mt-1 text-[13px] text-neutral-500">{label}</div>
    </div>
  );
}

/* ── Header compartilhado (menu do topo funcional) ───────────────────────── */
type NavItem =
  | { label: string; kind: 'tab'; value: PortalTab }
  | { label: string; kind: 'section'; value: string }
  | { label: string; kind: 'page'; value: string };

const NAV: NavItem[] = [
  { label: 'Comprar', kind: 'tab', value: 'sale' },
  { label: 'Alugar', kind: 'tab', value: 'rent' },
  { label: 'Lançamentos', kind: 'tab', value: 'launch' },
  { label: 'Sobre', kind: 'section', value: 'sobre' },
  { label: 'Contato', kind: 'section', value: 'contato' },
];

/** "Financiamento" e "Anuncie seu imóvel" só existem no menu quando o gestor
 *  ligou a página no Site Builder — link para uma página desligada é beco. */
export function extraPages(site: SiteInfo): NavItem[] {
  const out: NavItem[] = [];
  if (site.financiamento?.enabled) out.push({ label: 'Financiamento', kind: 'page', value: 'financiamento' });
  if (site.anuncie?.enabled) out.push({ label: 'Anuncie seu imóvel', kind: 'page', value: 'anuncie' });
  return out;
}

/** As redes cadastradas no Site Builder, na ordem em que saem na barra fina. */
const SOCIAL_ORDER = ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const;
const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', tiktok: 'TikTok',
};
export function socialEntries(site: SiteInfo): { key: string; label: string; url: string }[] {
  const links = site.social_links || {};
  const known = SOCIAL_ORDER.filter(k => (links[k] || '').trim());
  const rest = Object.keys(links).filter(k => !SOCIAL_ORDER.includes(k as typeof SOCIAL_ORDER[number]) && (links[k] || '').trim());
  return [...known, ...rest].map(k => ({
    key: k,
    label: SOCIAL_LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1),
    url: links[k].trim(),
  }));
}

/**
 * Barra fina acima do cabeçalho: telefone, e-mail e redes. Eles já eram
 * cadastrados no Site Builder e não apareciam em LUGAR NENHUM do site. Ela só
 * se desenha quando há o que mostrar — faixa vazia é pior que faixa nenhuma.
 *
 * ⚠️ Ela é do TOPO DA PÁGINA e rola para fora com o conteúdo: quem a desenhar
 * dentro do bloco que gruda no topo devolve o defeito de 17/09 — telefone e
 * e-mail numa faixa escura presa na tela durante a rolagem inteira.
 */
function PortalTopBar({ site }: { site: SiteInfo }) {
  const phone = site.contact?.phone?.trim();
  const email = site.contact?.email?.trim();
  const socials = socialEntries(site);
  if (!phone && !email && socials.length === 0) return null;

  return (
    <div className="hidden border-b border-white/10 bg-[var(--ink)] text-white/75 sm:block">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-6 px-4 text-[12.5px] sm:px-6">
        <div className="flex items-center gap-5">
          {phone && (
            <a href={`tel:${onlyDigits(phone)}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <Ic d={I.phone} s={13} /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <Ic d={I.mail} s={13} /> {email}
            </a>
          )}
        </div>
        {socials.length > 0 && (
          <div className="flex items-center gap-4">
            {socials.map(sn => (
              <a key={sn.key} href={sn.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                {sn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * `onHome`: na home o cabeçalho é TRANSPARENTE sobre a foto de capa e vira
 * sólido na rolagem; nas demais páginas ele é sólido desde o topo. Os links de
 * seção (Sobre/Contato) rolam a própria home via âncora e, fora dela, navegam
 * de volta apontando a seção.
 */
export function PortalHeader({ site, tenant, onHome = false }: { site: SiteInfo; tenant: string; onHome?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Só na home: antes de rolar, o cabeçalho flutua sobre a capa.
  const [scrolled, setScrolled] = useState(!onHome);
  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;
  const hasBlog = usePublishedArticlesExist(tenant);

  useEffect(() => {
    if (!onHome) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onHome]);

  // Seções liga/desliga (Site Builder). Ausência da flag = visível (retrocompat).
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;
  const nav = [
    ...NAV.filter(n => (n.value === 'sobre' ? showStats : n.value === 'contato' ? showLeadCapture : true)),
    ...extraPages(site),
  ];

  const sectionHref = (id: string) => (onHome ? `#${id}` : `/portal/${tenant}#${id}`);
  // Menu aberto sobre a capa é sempre sólido — texto branco sobre foto some.
  const floating = onHome && !scrolled && !menuOpen;

  const renderLink = (n: NavItem, onClick?: () => void, cls?: string) => {
    if (n.kind === 'tab') {
      return <Link key={n.label} to={`/portal/${tenant}/imoveis?tab=${n.value}`} onClick={onClick} className={cls}>{n.label}</Link>;
    }
    if (n.kind === 'page') {
      return <Link key={n.label} to={`/portal/${tenant}/${n.value}`} onClick={onClick} className={cls}>{n.label}</Link>;
    }
    return <a key={n.label} href={sectionHref(n.value)} onClick={onClick} className={cls}>{n.label}</a>;
  };

  const desktopCls = floating
    ? 'text-[14px] font-medium text-white/85 transition-colors hover:text-white'
    : 'text-[14px] font-medium text-neutral-600 transition-colors hover:text-[var(--brand)]';
  const mobileCls = 'block py-2.5 text-[15px] font-medium text-neutral-700';

  return (
    <>
      {/* A barra de contato fica no TOPO DA PÁGINA e rola para fora, nunca
          gruda. Dentro do bloco que gruda, telefone e e-mail ocupavam uma faixa
          escura presa na tela o tempo todo — e na home ela SURGIA na primeira
          rolagem (antes disso o cabeçalho é transparente e ela nem existe), que
          é quando ninguém pediu por ela. Na home o topo é a capa, então lá ela
          não entra: os mesmos contatos continuam no rodapé. */}
      {!onHome && <PortalTopBar site={site} />}

      {/* Na home o cabeçalho NUNCA entra no fluxo — ele flutua sobre a capa e
          continua flutuando ao rolar, só trocando de roupa. Trocando de fora do
          fluxo para dentro dele na primeira rolagem, a página inteira saltava
          para baixo a altura do cabeçalho. */}
      <div className={onHome ? 'fixed inset-x-0 top-0 z-40' : 'sticky top-0 z-40'}>
        <header
          className={`border-b transition-colors duration-300 ${
            floating
              ? 'border-white/15 bg-gradient-to-b from-black/40 to-transparent'
              : 'border-black/[0.06] bg-[var(--paper)]/90 backdrop-blur-md'
          }`}
        >
          {/* Logo maior a pedido do dono (2026-09-16): 56px de altura no
              desktop, 48px no celular. A barra cresce junto (84px / 72px) para
              o logo não encostar nas bordas, e o hero da home compensa esse
              ganho no padding do topo — o cabeçalho FLUTUA na home, então o
              título não desce sozinho. Logo horizontal bate primeiro no max-w,
              por isso a largura sobe na mesma proporção (190 → 260). */}
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:h-[84px] sm:px-6">
            <Link to={`/portal/${tenant}`} className="flex items-center gap-2.5">
              {site.branding?.logo_url ? (
                <img
                  src={site.branding.logo_url}
                  alt={site.name || 'Portal'}
                  className={`h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[260px] ${floating ? 'brightness-0 invert' : ''}`}
                />
              ) : (
                <span className={`font-[var(--display)] text-xl font-semibold tracking-tight ${floating ? 'text-white' : ''}`}>
                  {site.name || 'Imóveis'}
                </span>
              )}
            </Link>

            <nav className="hidden items-center gap-6 lg:flex">
              {nav.map(n => renderLink(n, undefined, desktopCls))}
              {hasBlog && <Link to={`/portal/${tenant}/blog`} className={desktopCls}>Blog</Link>}
            </nav>

            <div className="flex items-center gap-2">
              {waHref && (
                <a
                  href={waHref} target="_blank" rel="noreferrer"
                  aria-label="Falar no WhatsApp"
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white sm:px-4"
                  style={{ background: '#25D366' }}
                >
                  <Ic d={I.wa} s={16} /> <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
              <button
                type="button" aria-label="Menu" aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden ${floating ? 'text-white' : 'text-[var(--ink)]'}`}
              >
                <Ic d={menuOpen ? I.close : I.menu} s={22} />
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="border-t border-black/[0.06] bg-[var(--paper)] px-4 py-3 lg:hidden">
              {nav.map(n => renderLink(n, () => setMenuOpen(false), mobileCls))}
              {hasBlog && <Link to={`/portal/${tenant}/blog`} onClick={() => setMenuOpen(false)} className={mobileCls}>Blog</Link>}
              {(site.contact?.phone || site.contact?.email) && (
                <div className="mt-2 border-t border-black/[0.06] pt-2 text-[13px] text-neutral-500">
                  {site.contact?.phone && (
                    <a href={`tel:${onlyDigits(site.contact.phone)}`} className="block py-1.5">{site.contact.phone}</a>
                  )}
                  {site.contact?.email && (
                    <a href={`mailto:${site.contact.email}`} className="block py-1.5">{site.contact.email}</a>
                  )}
                </div>
              )}
            </nav>
          )}
        </header>
      </div>
    </>
  );
}

/* ── Faixa de atalhos da home ────────────────────────────────────────────── */
/**
 * Os três caminhos que não são "quero comprar": financiamento, anunciar o
 * próprio imóvel e pedir ajuda para achar.
 *
 * ⚠️ A faixa NÃO tem interruptor próprio, e é de propósito: ela aparece quando
 * existe pelo menos um destino de verdade. Como as duas páginas novas nascem
 * desligadas, nenhum site publicado ganha faixa sozinho no deploy — a doutrina
 * da casa de nada estrear ligado, sem custar mais uma chave para o gestor virar.
 */
export function HomeShortcuts({ site, tenant }: { site: SiteInfo; tenant: string }) {
  const showLeadCapture = site.sections?.lead_capture !== false;

  const cards = [
    site.financiamento?.enabled && {
      key: 'financiamento',
      icon: I.bank,
      title: 'Financiamento',
      desc: 'Simule com os principais bancos e descubra quanto você consegue financiar.',
      cta: 'Faça uma simulação',
      to: `/portal/${tenant}/financiamento`,
    },
    site.anuncie?.enabled && {
      key: 'anuncie',
      icon: I.sign,
      title: 'Anuncie seu imóvel',
      desc: 'Tem um imóvel para vender ou alugar? Preencha a ficha e a gente avalia.',
      cta: 'Cadastre seu imóvel',
      to: `/portal/${tenant}/anuncie`,
    },
    showLeadCapture && {
      key: 'encomenda',
      icon: I.search,
      title: 'Imóvel sob encomenda',
      desc: 'Descreva o que você procura e avisamos assim que encontrarmos.',
      cta: 'Encomende seu imóvel',
      to: '#contato',
    },
  ].filter(Boolean) as { key: string; icon: string; title: string; desc: string; cta: string; to: string }[];

  // Só a busca de imóvel ligada não justifica uma faixa: ela repetiria, em
  // forma de cartão, o bloco de captura que já está logo abaixo na home.
  if (cards.length < 2) return null;

  return (
    <section className="border-y border-black/[0.06]" style={{ background: 'var(--ink)' }}>
      <div className={`mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 ${cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {cards.map(c => {
          const inner = (
            <>
              <span className="text-white/80"><Ic d={c.icon} s={26} /></span>
              <h3 className="mt-4 font-[var(--display)] text-[22px] font-semibold text-white">{c.title}</h3>
              <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-white/70">{c.desc}</p>
              <span className="mt-5 inline-flex items-center gap-2 border-b-2 border-white/60 pb-1 text-[14px] font-semibold text-white transition-colors group-hover:border-[var(--brand)]">
                {c.cta} <Ic d={I.arrow} s={16} />
              </span>
            </>
          );
          const cls = 'group flex flex-col items-start text-left';
          return c.to.startsWith('#')
            ? <a key={c.key} href={c.to} className={cls}>{inner}</a>
            : <Link key={c.key} to={c.to} className={cls}>{inner}</Link>;
        })}
      </div>
    </section>
  );
}

/* ── Footer compartilhado ────────────────────────────────────────────────── */
function FooterCol({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
const footerLinkCls = 'text-[13px] text-neutral-600 hover:text-[var(--brand)]';

export function PortalFooter({ site, tenant, onHome = false }: { site: SiteInfo; tenant: string; onHome?: boolean }) {
  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;
  const hasBlog = usePublishedArticlesExist(tenant);
  const sectionHref = (id: string) => (onHome ? `#${id}` : `/portal/${tenant}#${id}`);

  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6">
        <div className="col-span-2 sm:col-span-1">
          {site.branding?.logo_url
            ? <img src={site.branding.logo_url} alt={site.name || ''} className="h-9 w-auto max-w-[150px] object-contain" />
            : <span className="font-[var(--display)] text-lg font-semibold">{site.name || 'Imóveis'}</span>}
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-500">Seu portal de imóveis com atendimento de verdade.</p>
        </div>
        <FooterCol title="Imóveis">
          <li><Link to={`/portal/${tenant}/imoveis?tab=sale`} className={footerLinkCls}>Comprar</Link></li>
          <li><Link to={`/portal/${tenant}/imoveis?tab=rent`} className={footerLinkCls}>Alugar</Link></li>
          <li><Link to={`/portal/${tenant}/imoveis?tab=launch`} className={footerLinkCls}>Lançamentos</Link></li>
        </FooterCol>
        <FooterCol title="Institucional">
          {showStats && <li><a href={sectionHref('sobre')} className={footerLinkCls}>Sobre nós</a></li>}
          {hasBlog && <li><Link to={`/portal/${tenant}/blog`} className={footerLinkCls}>Blog</Link></li>}
          {showLeadCapture && <li><a href={sectionHref('contato')} className={footerLinkCls}>Contato</a></li>}
          {/* "Anuncie" rolava para o formulário de QUEM COMPRA: o proprietário
              que queria VENDER caía no formulário contrário. Agora ele só existe
              quando a página de verdade está ligada, e aponta para ela. */}
          {site.anuncie?.enabled && (
            <li><Link to={`/portal/${tenant}/anuncie`} className={footerLinkCls}>Anuncie seu imóvel</Link></li>
          )}
          {site.financiamento?.enabled && (
            <li><Link to={`/portal/${tenant}/financiamento`} className={footerLinkCls}>Financiamento</Link></li>
          )}
        </FooterCol>
        <div>
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Contato</h4>
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={15} /> WhatsApp</a>}
          <div className="mt-3 space-y-1.5 text-[13px] text-neutral-600">
            {site.contact?.phone && <div><a href={`tel:${onlyDigits(site.contact.phone)}`} className="hover:text-[var(--brand)]">{site.contact.phone}</a></div>}
            {site.contact?.email && <div><a href={`mailto:${site.contact.email}`} className="break-all hover:text-[var(--brand)]">{site.contact.email}</a></div>}
            {site.contact?.address && <div className="text-neutral-500">{site.contact.address}</div>}
          </div>
          {socialEntries(site).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              {socialEntries(site).map(sn => (
                <a key={sn.key} href={sn.url} target="_blank" rel="noreferrer" className={footerLinkCls}>{sn.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-black/[0.06] py-5 text-center text-[12px] text-neutral-400">
        © {site.name || 'Portal'} — feito com LM Flow.
      </div>
    </footer>
  );
}
