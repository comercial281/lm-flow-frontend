import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
export interface SiteInfo {
  name?: string;
  branding?: Branding;
  hero?: { video_url?: string | null };
  contact?: { whatsapp?: string | null; phone?: string | null };
  seo?: { title?: string | null; description?: string | null };
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
        const [siteRes, propsRes] = await Promise.all([
          fetch(`${API}/api/public/v1/site`, { headers: { 'X-Tenant': tenant } }),
          fetch(`${API}/api/public/v1/site/properties?per_page=60`, { headers: { 'X-Tenant': tenant } }),
        ]);
        if (!active) return;
        const siteJson = siteRes.ok ? ((await siteRes.json()).data as SiteInfo) : {};
        const propsJson = propsRes.ok ? ((await propsRes.json()).data as PortalProperty[]) : [];
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
  | { label: string; kind: 'section'; value: string };

const NAV: NavItem[] = [
  { label: 'Comprar', kind: 'tab', value: 'sale' },
  { label: 'Alugar', kind: 'tab', value: 'rent' },
  { label: 'Lançamentos', kind: 'tab', value: 'launch' },
  { label: 'Sobre', kind: 'section', value: 'sobre' },
  { label: 'Contato', kind: 'section', value: 'contato' },
];

/**
 * `onHome`: quando true (na home), links de seção (Sobre/Contato) rolam a
 * própria página via âncora `#id`; quando false (na busca), navegam de volta
 * para a home apontando a seção.
 */
export function PortalHeader({ site, tenant, onHome = false }: { site: SiteInfo; tenant: string; onHome?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;

  const sectionHref = (id: string) => (onHome ? `#${id}` : `/portal/${tenant}#${id}`);

  const renderLink = (n: NavItem, onClick?: () => void, cls?: string) => {
    if (n.kind === 'tab') {
      return (
        <Link key={n.label} to={`/portal/${tenant}/imoveis?tab=${n.value}`} onClick={onClick} className={cls}>{n.label}</Link>
      );
    }
    return <a key={n.label} href={sectionHref(n.value)} onClick={onClick} className={cls}>{n.label}</a>;
  };

  const desktopCls = 'text-[14px] font-medium text-neutral-600 transition-colors hover:text-[var(--brand)]';
  const mobileCls = 'block py-2.5 text-[15px] font-medium text-neutral-700';

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[var(--paper)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to={`/portal/${tenant}`} className="flex items-center gap-2.5">
          {site.branding?.logo_url ? (
            <img src={site.branding.logo_url} alt={site.name || 'Portal'} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="font-[var(--display)] text-xl font-semibold tracking-tight">{site.name || 'Imóveis'}</span>
          )}
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map(n => renderLink(n, undefined, desktopCls))}
        </nav>

        <div className="flex items-center gap-2">
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white sm:inline-flex" style={{ background: '#25D366' }}>
              <Ic d={I.wa} s={16} /> WhatsApp
            </a>
          )}
          <button type="button" aria-label="Menu" onClick={() => setMenuOpen(o => !o)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] md:hidden">
            <Ic d={menuOpen ? I.close : I.menu} s={22} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-black/[0.06] bg-[var(--paper)] px-4 py-3 md:hidden">
          {NAV.map(n => renderLink(n, () => setMenuOpen(false), mobileCls))}
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={16} /> Falar no WhatsApp</a>}
        </nav>
      )}
    </header>
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
          <li><a href={sectionHref('sobre')} className={footerLinkCls}>Sobre nós</a></li>
          <li><a href={sectionHref('contato')} className={footerLinkCls}>Contato</a></li>
          <li><a href={sectionHref('contato')} className={footerLinkCls}>Anuncie</a></li>
        </FooterCol>
        <div>
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Contato</h4>
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={15} /> WhatsApp</a>}
        </div>
      </div>
      <div className="border-t border-black/[0.06] py-5 text-center text-[12px] text-neutral-400">
        © {site.name || 'Portal'} — feito com LM Flow.
      </div>
    </footer>
  );
}
