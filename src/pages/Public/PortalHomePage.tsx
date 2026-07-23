import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — HOME (Produto A do LM Flow)
   Template "Editorial Estate": moderno, mobile-first, focado na conversão do
   lead. TUDO é dirigido pelos tokens de marca do cliente (logo, cores, fonte,
   WhatsApp), vindos do registro do Site. Zero marca hardcoded.
──────────────────────────────────────────────────────────────────────────── */

interface Branding {
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
}
interface SiteInfo {
  name?: string;
  branding?: Branding;
  hero?: { video_url?: string | null };
  sections?: { stats?: boolean; lead_capture?: boolean };
  contact?: { whatsapp?: string | null; phone?: string | null };
  seo?: { title?: string | null; description?: string | null };
}
interface PortalProperty {
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

const API = import.meta.env.VITE_API_URL as string;

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: 'Apartamento', house: 'Casa', condo: 'Casa em condomínio',
  land: 'Terreno', commercial: 'Comercial', studio: 'Studio', farm: 'Chácara',
};
function onlyDigits(s?: string | null) { return (s || '').replace(/\D/g, ''); }

/* ── SVG icons (inline, sem dependência) ─────────────────────────────────── */
const I = {
  bed: 'M2 17v-5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v4M2 21v-4M22 21v-6M2 12V7m4 3V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2',
  bath: 'M4 12V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 21l-1 1M18 21l1 1',
  car: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 15h12M3 15l1.5-5A2 2 0 0 1 6.4 8.6h9.2a2 2 0 0 1 1.9 1.4L19 15',
  ruler: 'M3 3h4v4M3 3l7 7M21 21h-4v-4M21 21l-7-7M3 21v-4M3 21h4M21 3h-4M21 3v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  wa: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.2 1.2-1.7 1.2-.9.1-1 .4-3.6-.9-2.6-1.4-4.1-4.1-4.2-4.3-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2 1.3 2.3 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z',
  menu: 'M3 6h18M3 12h18M3 18h18', close: 'M6 6l12 12M18 6L6 18',
};
function Ic({ d, s = 18, cls = '' }: { d: string; s?: number; cls?: string }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={cls}><path d={d} /></svg>;
}

/* ── Card de imóvel ──────────────────────────────────────────────────────── */
function PropertyCard({ tenant, p, wa }: { tenant: string; p: PortalProperty; wa?: string | null }) {
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

/* ── Página ──────────────────────────────────────────────────────────────── */
export default function PortalHomePage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [site, setSite] = useState<SiteInfo>({});
  const [items, setItems] = useState<PortalProperty[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // filtros de busca
  const [tab, setTab] = useState<'sale' | 'rent' | 'launch'>('sale');
  const [fType, setFType] = useState('');
  const [fCity, setFCity] = useState('');
  const [fNeighborhood, setFNeighborhood] = useState('');
  const [fBedrooms, setFBedrooms] = useState('');
  const [fCode, setFCode] = useState('');
  const [applied, setApplied] = useState(0);

  // lead capture
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadPhoneErr, setLeadPhoneErr] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

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

  const filtered = useMemo(() => {
    if (!applied) return items;
    return items.filter(p => {
      if (tab === 'rent' && p.transaction_type !== 'rent') return false;
      if (tab === 'sale' && p.transaction_type === 'rent') return false;
      if (fType && p.property_type !== fType) return false;
      if (fCity && p.address?.city !== fCity) return false;
      if (fNeighborhood && p.address?.neighborhood !== fNeighborhood) return false;
      if (fBedrooms && (p.icon_summary?.bedrooms ?? 0) < Number(fBedrooms)) return false;
      if (fCode && !p.code.toLowerCase().includes(fCode.toLowerCase())) return false;
      return true;
    });
  }, [items, applied, tab, fType, fCity, fNeighborhood, fBedrooms, fCode]);

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    setApplied(a => a + 1);
    document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !leadName.trim()) return;
    if (!isValidBrPhone(leadPhone)) { setLeadPhoneErr(true); return; }
    try {
      await fetch(`${API}/api/public/v1/site/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
        body: JSON.stringify({ lead: { name: leadName, phone: leadPhone, source: 'portal', form_type: 'home', message: 'Quero ajuda pra encontrar um imóvel (portal home).' } }),
      });
      setLeadSent(true);
    } catch { /* silencioso */ }
  };

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  const cssVars = {
    ['--brand' as string]: brand,
    ['--accent' as string]: accent,
    ['--ink' as string]: '#17140F',
    ['--paper' as string]: '#FAF7F2',
    ['--display' as string]: fontStack,
    fontFamily: fontStack,
  } as CSSProperties;

  // Seções liga/desliga (Site Builder). Ausência da flag = visível (retrocompat).
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;

  const nav = [
    { label: 'Comprar', href: '#resultados' },
    { label: 'Alugar', href: '#resultados' },
    { label: 'Lançamentos', href: '#resultados' },
    ...(showStats ? [{ label: 'Sobre', href: '#sobre' }] : []),
    ...(showLeadCapture ? [{ label: 'Contato', href: '#contato' }] : []),
  ];
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      {/* Fonte do site (definida no Site Builder) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      {/* ── Header sticky ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[var(--paper)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#topo" className="flex items-center gap-2.5">
            {site.branding?.logo_url ? (
              <img src={site.branding.logo_url} alt={site.name || 'Portal'} className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <span className="font-[var(--display)] text-xl font-semibold tracking-tight">{site.name || 'Imóveis'}</span>
            )}
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {nav.map(n => (
              <a key={n.label} href={n.href} className="text-[14px] font-medium text-neutral-600 transition-colors hover:text-[var(--brand)]">{n.label}</a>
            ))}
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
            {nav.map(n => (
              <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="block py-2.5 text-[15px] font-medium text-neutral-700">{n.label}</a>
            ))}
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={16} /> Falar no WhatsApp</a>}
          </nav>
        )}
      </header>

      {/* ── Hero + busca ──────────────────────────────────────────────── */}
      <section id="topo" className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: '#17140f' }}>
          {site.hero?.video_url ? (
            <video
              src={site.hero.video_url}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={items[0]?.cover_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80'} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(23,20,15,0.35) 0%, rgba(23,20,15,0.55) 55%, var(--paper) 100%)' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24 md:pb-16 md:pt-28">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/80">{site.name || 'Portal Imobiliário'}</p>
          <h1 className="mt-3 max-w-2xl font-[var(--display)] text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl">
            O imóvel certo pra sua próxima fase.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">
            {site.seo?.description || 'Apartamentos, casas e lançamentos com curadoria, fotos reais e atendimento humano de verdade.'}
          </p>

          {/* Busca */}
          <form onSubmit={runSearch} className="mt-8 rounded-[24px] bg-white/95 p-3 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)] backdrop-blur sm:p-4">
            <div className="mb-3 flex gap-1.5">
              {([['sale', 'Comprar'], ['rent', 'Alugar'], ['launch', 'Lançamentos']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
                  style={tab === k ? { background: 'var(--brand)' } : undefined}>
                  {l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={fType} onChange={setFType} label="Tipo" options={types.map(t => [t, PROPERTY_TYPE_LABEL[t] || t])} />
              <Select value={fCity} onChange={setFCity} label="Cidade" options={cities.map(c => [c, c])} />
              <Select value={fNeighborhood} onChange={setFNeighborhood} label="Bairro" options={hoods.map(h => [h, h])} />
              <Select value={fBedrooms} onChange={setFBedrooms} label="Dormitórios" options={[['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']]} />
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Ic d={I.search} s={17} /></span>
                <input value={fCode} onChange={e => setFCode(e.target.value)} placeholder="Buscar por código do imóvel"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)]" />
              </div>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--brand)' }}>
                <Ic d={I.search} s={17} /> Buscar
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Resultados / destaques ────────────────────────────────────── */}
      <section id="resultados" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{applied ? 'Resultados' : 'Selecionados a dedo'}</span>
            <h2 className="mt-1 font-[var(--display)] text-3xl font-semibold sm:text-4xl">{applied ? `${filtered.length} imóvel${filtered.length !== 1 ? 'is' : ''} encontrado${filtered.length !== 1 ? 's' : ''}` : 'Imóveis em destaque'}</h2>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-16 text-center text-neutral-500">
            Nenhum imóvel com esses filtros. <button type="button" onClick={() => { setApplied(0); setFType(''); setFCity(''); setFNeighborhood(''); setFBedrooms(''); setFCode(''); }} className="font-semibold text-[var(--brand)] underline">Limpar busca</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => <PropertyCard key={p.id} tenant={tenant!} p={p} wa={wa} />)}
          </div>
        )}
      </section>

      {/* ── Trust band ────────────────────────────────────────────────── */}
      {showStats && (
      <section id="sobre" className="border-y border-black/[0.06] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-6 px-4 py-10 text-center sm:px-6">
          <Stat n={String(items.length)} label="imóveis disponíveis" />
          <Stat n={String(cities.length || 1)} label={cities.length === 1 ? 'cidade atendida' : 'cidades atendidas'} />
          <Stat n="24h" label="resposta no WhatsApp" />
        </div>
      </section>
      )}

      {/* ── Lead capture ──────────────────────────────────────────────── */}
      {showLeadCapture && (
      <section id="contato" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14" style={{ background: 'var(--ink)' }}>
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="text-white">
              <h2 className="font-[var(--display)] text-3xl font-semibold leading-tight sm:text-4xl">Não achou? A gente encontra pra você.</h2>
              <p className="mt-3 max-w-md text-[15px] text-white/70">Deixe seu contato e um especialista traz opções que combinam com o que você procura — sem robô, sem enrolação.</p>
            </div>
            {leadSent ? (
              <div className="rounded-2xl bg-white/10 p-8 text-center text-white ring-1 ring-white/15">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-lg font-semibold">Recebemos seu contato!</p>
                <p className="mt-1 text-white/70">Um especialista vai te chamar em breve.</p>
              </div>
            ) : (
              <form onSubmit={submitLead} className="rounded-2xl bg-white p-5 shadow-xl">
                <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Seu nome</label>
                <input value={leadName} onChange={e => setLeadName(e.target.value)} required placeholder="Como podemos te chamar?" className="mb-3 w-full rounded-xl border border-black/10 px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]" />
                <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">WhatsApp</label>
                <BrPhoneInput
                  value={leadPhone}
                  onChange={v => { setLeadPhone(v); if (leadPhoneErr) setLeadPhoneErr(false); }}
                  required
                  aria-invalid={leadPhoneErr}
                  className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] ${leadPhoneErr ? 'border-red-400' : 'border-black/10'}`}
                />
                {leadPhoneErr
                  ? <p className="mt-1 mb-4 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>
                  : <div className="mb-4" />}
                <button type="submit" className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--brand)' }}>Quero ajuda pra encontrar</button>
              </form>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/[0.06] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6">
          <div className="col-span-2 sm:col-span-1">
            {site.branding?.logo_url
              ? <img src={site.branding.logo_url} alt={site.name || ''} className="h-9 w-auto max-w-[150px] object-contain" />
              : <span className="font-[var(--display)] text-lg font-semibold">{site.name || 'Imóveis'}</span>}
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-500">Seu portal de imóveis com atendimento de verdade.</p>
          </div>
          <FooterCol title="Imóveis" links={['Comprar', 'Alugar', 'Lançamentos']} />
          <FooterCol title="Institucional" links={['Sobre nós', 'Contato', 'Anuncie']} />
          <div>
            <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Contato</h4>
            {wa && <a href={waHref!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={15} /> WhatsApp</a>}
          </div>
        </div>
        <div className="border-t border-black/[0.06] py-5 text-center text-[12px] text-neutral-400">
          © {site.name || 'Portal'} — feito com LM Flow.
        </div>
      </footer>
    </div>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────── */
function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
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
function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-[var(--display)] text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{n}</div>
      <div className="mt-1 text-[13px] text-neutral-500">{label}</div>
    </div>
  );
}
function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
      <ul className="space-y-2">
        {links.map(l => <li key={l}><a href="#resultados" className="text-[13px] text-neutral-600 hover:text-[var(--brand)]">{l}</a></li>)}
      </ul>
    </div>
  );
}
