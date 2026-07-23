import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — PÁGINA DO IMÓVEL (Produto A). Mesma pegada "Editorial
   Estate" da home: moderna, indexável (SEO), focada em converter o lead via
   WhatsApp + formulário. Brandável pelo registro do Site (logo/cor/WhatsApp).
──────────────────────────────────────────────────────────────────────────── */

interface Photo { file_url: string; thumbnail_url?: string | null; caption?: string | null; alt_text?: string | null; is_cover?: boolean }
interface PropertyDTO {
  id?: string; code: string; title: string; description?: string;
  transaction_type?: string; property_type?: string;
  sale_price?: number | null; rent_price?: number | null;
  condo_fee?: number | null; iptu?: number | null;
  bedrooms?: number | null; bathrooms?: number | null; suites?: number | null; parking_spaces?: number | null;
  useful_area_m2?: number | null; total_area_m2?: number | null;
  address_neighborhood?: string; address_city?: string; address_state?: string;
  address_full?: string;
  latitude?: number | null; longitude?: number | null;
  responsible_name?: string; photos?: Photo[];
}
interface SiteInfo {
  name?: string;
  branding?: { logo_url?: string | null; primary_color?: string | null; accent_color?: string | null; font_family?: string | null };
  contact?: { whatsapp?: string | null };
}

const API = import.meta.env.VITE_API_URL as string;
const TYPE_LABEL: Record<string, string> = { apartment: 'Apartamento', house: 'Casa', condo: 'Casa em condomínio', land: 'Terreno', commercial: 'Comercial', studio: 'Studio', farm: 'Chácara' };

function onlyDigits(s?: string | null) { return (s || '').replace(/\D/g, ''); }
function brl(n?: number | null) { return typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null; }
function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

const I = {
  bed: 'M2 17v-5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v4M2 21v-4M22 21v-6M2 12V7m4 3V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2',
  suite: 'M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18v2M21 18v2M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M17 4l1.5 1.5L20 4',
  bath: 'M4 12V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 21l-1 1M18 21l1 1',
  car: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 15h12M3 15l1.5-5A2 2 0 0 1 6.4 8.6h9.2a2 2 0 0 1 1.9 1.4L19 15',
  ruler: 'M3 3h4v4M3 3l7 7M21 21h-4v-4M21 21l-7-7M3 21v-4M3 21h4M21 3h-4M21 3v4',
  land: 'M3 4h18v16H3zM3 9h18M9 4v16',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  tag: 'M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h8l8.6 8.6a1 1 0 0 1 0 1.4ZM7.5 8.5h.01',
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v10M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.8 2.5 1.8s-1.1 1.7-2.5 1.7-2.5.8-2.5 1.8 1.1 1.8 2.5 1.8a2.5 2 0 0 0 2.5-1.5',
  wa: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.2 1.2-1.7 1.2-.9.1-1 .4-3.6-.9-2.6-1.4-4.1-4.1-4.2-4.3-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2 1.3 2.3 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
};
function Ic({ d, s = 18, cls = '' }: { d: string; s?: number; cls?: string }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={cls}><path d={d} /></svg>;
}

export default function ImovelPublicPage() {
  const { tenant, code } = useParams<{ tenant: string; code: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [site, setSite] = useState<SiteInfo>({});
  const [prop, setProp] = useState<PropertyDTO | null>(null);
  const [active, setActive] = useState(0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tenant || !code) return;
      try {
        const [siteRes, imovelRes] = await Promise.all([
          fetch(`${API}/api/public/v1/site`, { headers: { 'X-Tenant': tenant } }),
          fetch(`${API}/api/public/v1/site/properties/${encodeURIComponent(code)}`, { headers: { 'X-Tenant': tenant } }),
        ]);
        if (!alive) return;
        if (!imovelRes.ok) { setState('notfound'); return; }
        // O back-end serializa o imóvel direto em `data` (objeto plano).
        const property = (await imovelRes.json()).data as PropertyDTO;
        const siteInfo = siteRes.ok ? ((await siteRes.json()).data as SiteInfo) : {};
        setSite(siteInfo);
        setProp(property);

        const siteName = siteInfo.name || 'Imóveis';
        document.title = `${property.title} · ${siteName}`;
        const desc = (property.description || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (desc) setMeta('description', desc);
        setMeta('robots', 'index,follow');
        setState('ok');
      } catch { if (alive) setState('notfound'); }
    })();
    return () => { alive = false; };
  }, [tenant, code]);

  const brand = site.branding?.primary_color || '#0E7C5A';
  const font = site.branding?.font_family || 'Inter';
  const fontPrimary = font.split(',')[0].trim();
  const fontStack = font.includes(',') ? font : `${font}, system-ui, sans-serif`;
  const fontHref = `https://fonts.googleapis.com/css2?family=${fontPrimary.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  const wa = site.contact?.whatsapp;
  const waHref = useMemo(() => {
    if (!wa || !prop) return null;
    return `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${prop.code} — ${prop.title}.`)}`;
  }, [wa, prop]);

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !code || !name.trim()) return;
    if (!isValidBrPhone(phone)) { setPhoneErr(true); return; }
    const params = new URLSearchParams(window.location.search);
    try {
      await fetch(`${API}/api/public/v1/site/leads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
        body: JSON.stringify({ lead: {
          name, phone, source: 'portal', form_type: 'imovel',
          property_code: code, property_id: prop?.id,
          message: `Interesse no imóvel ${code}`,
          utm_source: params.get('utm_source') ?? undefined, utm_campaign: params.get('utm_campaign') ?? undefined,
          form_data: { page_url: window.location.href, referrer: document.referrer || null },
        } }),
      });
      setSent(true);
    } catch { /* silencioso */ }
  };

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  if (state === 'notfound' || !prop) return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Imóvel não encontrado.</div>;

  const cssVars = { ['--brand' as string]: brand, ['--ink' as string]: '#17140F', ['--paper' as string]: '#FAF7F2', ['--display' as string]: fontStack, fontFamily: fontStack } as CSSProperties;
  const photos = prop.photos ?? [];
  const cover = photos[active] || photos[0];
  const local = [prop.address_neighborhood, prop.address_city, prop.address_state].filter(Boolean).join(', ');
  const typeLabel = TYPE_LABEL[prop.property_type || ''] || prop.property_type || 'Imóvel';

  // Preço principal segue o tipo de transação (aluguel mostra "/mês"; venda, o
  // valor cheio). Locação sem venda cai no aluguel; senão, venda.
  const isRent = prop.transaction_type === 'rent' || prop.transaction_type === 'season';
  const price = brl(isRent ? prop.rent_price : prop.sale_price);
  const priceSuffix = isRent ? '/mês' : '';
  // Valor do m²: base de venda sobre a área útil (ou total como fallback).
  const areaForM2 = prop.useful_area_m2 || prop.total_area_m2 || 0;
  const pricePerM2 = !isRent && prop.sale_price && areaForM2 ? brl(prop.sale_price / areaForM2) : null;
  // Linha de valores recorrentes (condomínio / IPTU / m²), como nos portais.
  const money = [
    prop.condo_fee ? { label: 'Condomínio', value: `${brl(prop.condo_fee)}/mês` } : null,
    prop.iptu ? { label: 'IPTU', value: `${brl(prop.iptu)}/ano` } : null,
    pricePerM2 ? { label: 'Valor do m²', value: pricePerM2 } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const specs = [
    prop.bedrooms ? { d: I.bed, label: `${prop.bedrooms} ${prop.bedrooms > 1 ? 'quartos' : 'quarto'}` } : null,
    prop.suites ? { d: I.suite, label: `${prop.suites} ${prop.suites > 1 ? 'suítes' : 'suíte'}` } : null,
    prop.bathrooms ? { d: I.bath, label: `${prop.bathrooms} ${prop.bathrooms > 1 ? 'banheiros' : 'banheiro'}` } : null,
    prop.parking_spaces ? { d: I.car, label: `${prop.parking_spaces} ${prop.parking_spaces > 1 ? 'vagas' : 'vaga'}` } : null,
    prop.useful_area_m2 ? { d: I.ruler, label: `${prop.useful_area_m2} m² úteis` } : null,
    prop.total_area_m2 ? { d: I.land, label: `${prop.total_area_m2} m² total` } : null,
  ].filter(Boolean) as { d: string; label: string }[];

  // Ficha técnica — pares rótulo/valor com tudo que o imóvel tem cadastrado.
  const sheet = [
    { label: 'Código', value: prop.code },
    { label: 'Tipo', value: typeLabel },
    { label: 'Transação', value: isRent ? 'Locação' : 'Venda' },
    prop.bedrooms ? { label: 'Quartos', value: String(prop.bedrooms) } : null,
    prop.suites ? { label: 'Suítes', value: String(prop.suites) } : null,
    prop.bathrooms ? { label: 'Banheiros', value: String(prop.bathrooms) } : null,
    prop.parking_spaces ? { label: 'Vagas', value: String(prop.parking_spaces) } : null,
    prop.useful_area_m2 ? { label: 'Área útil', value: `${prop.useful_area_m2} m²` } : null,
    prop.total_area_m2 ? { label: 'Área total', value: `${prop.total_area_m2} m²` } : null,
    prop.condo_fee ? { label: 'Condomínio', value: `${brl(prop.condo_fee)}/mês` } : null,
    prop.iptu ? { label: 'IPTU', value: `${brl(prop.iptu)}/ano` } : null,
    prop.address_full ? { label: 'Endereço', value: prop.address_full } : (local ? { label: 'Localização', value: local } : null),
  ].filter(Boolean) as { label: string; value: string }[];

  const ContactForm = (
    sent ? (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/[0.06]">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <p className="font-semibold text-[var(--ink)]">Recebemos seu interesse!</p>
        <p className="mt-1 text-sm text-neutral-500">Um especialista vai te chamar em breve.</p>
      </div>
    ) : (
      <form onSubmit={submitLead} className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" className="w-full rounded-xl border border-black/10 px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]" />
        <BrPhoneInput
          value={phone}
          onChange={v => { setPhone(v); if (phoneErr) setPhoneErr(false); }}
          required
          placeholder="Seu WhatsApp"
          aria-invalid={phoneErr}
          className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] ${phoneErr ? 'border-red-400' : 'border-black/10'}`}
        />
        {phoneErr && <p className="-mt-1 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>}
        <button type="submit" className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--brand)' }}>Tenho interesse</button>
        {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={18} /> Chamar no WhatsApp</a>}
      </form>
    )
  );

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--paper)] pb-24 text-[var(--ink)] antialiased lg:pb-0">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[var(--paper)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to={`/portal/${tenant}`} className="flex items-center gap-2.5">
            {site.branding?.logo_url
              ? <img src={site.branding.logo_url} alt={site.name || ''} className="h-9 w-auto max-w-[150px] object-contain" />
              : <span className="font-[var(--display)] text-xl font-semibold tracking-tight">{site.name || 'Imóveis'}</span>}
          </Link>
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}>
              <Ic d={I.wa} s={16} /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Link to={`/portal/${tenant}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-[var(--brand)]">
          <Ic d={I.back} s={16} /> Voltar aos imóveis
        </Link>

        {/* Galeria */}
        {cover && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="group relative overflow-hidden rounded-[20px] bg-neutral-100">
              <img src={cover.file_url} alt={cover.alt_text || prop.title} className="h-[280px] w-full object-cover sm:h-[440px]" />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() => setActive(a => (a - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[var(--ink)] shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-white"
                  >
                    <Ic d={I.back} s={20} />
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima foto"
                    onClick={() => setActive(a => (a + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[var(--ink)] shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-white"
                  >
                    <Ic d={I.next} s={20} />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
                    {active + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto sm:max-h-[440px] sm:w-24 sm:flex-col sm:overflow-y-auto">
                {photos.map((ph, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-full ${i === active ? 'ring-2 ring-[var(--brand)]' : 'ring-1 ring-black/[0.06] opacity-80'}`}>
                    <img src={ph.thumbnail_url || ph.file_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Conteúdo */}
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{typeLabel}</span>
            <h1 className="mt-1.5 font-[var(--display)] text-3xl font-semibold leading-tight sm:text-4xl">{prop.title}</h1>
            {local && <p className="mt-2 flex items-center gap-1.5 text-[15px] text-neutral-500"><Ic d={I.pin} s={16} /> {local}</p>}

            {specs.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s, i) => (
                  <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
                    <span className="text-[var(--brand)]"><Ic d={s.d} s={20} /></span>
                    <div className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {money.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white px-5 py-4 ring-1 ring-black/[0.06]">
                {money.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[var(--brand)]"><Ic d={I.coin} s={17} /></span>
                    <span className="text-[13px] text-neutral-500">{m.label}</span>
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{m.value}</span>
                  </div>
                ))}
              </div>
            )}

            {prop.description && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Sobre o imóvel</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">{prop.description}</p>
              </section>
            )}

            {sheet.length > 0 && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Ficha técnica</h2>
                <dl className="mt-3 overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06]">
                  {sheet.map((row, i) => (
                    <div key={i} className={`flex items-start justify-between gap-6 px-5 py-3.5 ${i > 0 ? 'border-t border-black/[0.06]' : ''}`}>
                      <dt className="flex items-center gap-2 text-[14px] text-neutral-500">
                        <span className="text-[var(--brand)]"><Ic d={row.label === 'Código' ? I.tag : row.label === 'Tipo' ? I.home : row.label === 'Endereço' || row.label === 'Localização' ? I.pin : I.ruler} s={15} /></span>
                        {row.label}
                      </dt>
                      <dd className="text-right text-[14px] font-semibold text-[var(--ink)]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {typeof prop.latitude === 'number' && typeof prop.longitude === 'number' && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Localização</h2>
                {local && <p className="mt-1 text-[14px] text-neutral-500">{local}</p>}
                <div className="mt-3 overflow-hidden rounded-[20px] ring-1 ring-black/[0.06]">
                  <iframe title="Mapa" width="100%" height="300" loading="lazy" style={{ border: 0 }}
                    src={`https://www.google.com/maps?q=${prop.latitude},${prop.longitude}&z=15&output=embed`} />
                </div>
              </section>
            )}
          </div>

          {/* Card de contato (sticky no desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[22px] bg-white p-6 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06]">
              {price && (
                <div className="font-[var(--display)] text-3xl font-semibold text-[var(--ink)]">
                  {price}{priceSuffix && <span className="text-base font-medium text-neutral-400">{priceSuffix}</span>}
                </div>
              )}
              <div className="mt-1 text-[13px] text-neutral-500">Código {prop.code}</div>
              {money.length > 0 && (
                <div className="mt-3 space-y-1">
                  {money.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">{m.label}</span>
                      <span className="font-medium text-[var(--ink)]">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="my-4 border-t border-black/[0.06]" />
              <p className="mb-3 text-[14px] font-medium text-neutral-600">Fale com um especialista sobre este imóvel</p>
              {ContactForm}
              {prop.responsible_name && <p className="mt-4 text-center text-[12px] text-neutral-400">Atendimento: {prop.responsible_name}</p>}
            </div>
          </aside>
        </div>

        {/* Form no fluxo (mobile) */}
        <section id="contato" className="mt-10 rounded-[22px] bg-white p-6 ring-1 ring-black/[0.06] lg:hidden">
          {price && (
            <div className="font-[var(--display)] text-2xl font-semibold">
              {price}{priceSuffix && <span className="text-sm font-medium text-neutral-400">{priceSuffix}</span>}
            </div>
          )}
          {money.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-500">
              {money.map((m, i) => <span key={i}>{m.label} <span className="font-medium text-[var(--ink)]">{m.value}</span></span>)}
            </div>
          )}
          <p className="mb-3 mt-2 text-[14px] text-neutral-500">Fale com um especialista sobre este imóvel</p>
          {ContactForm}
        </section>
      </main>

      {/* Barra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {price && <div className="flex-1"><div className="text-[11px] text-neutral-400">{isRent ? 'aluguel' : 'a partir de'}</div><div className="font-[var(--display)] text-lg font-semibold leading-none">{price}{priceSuffix && <span className="text-[11px] font-medium text-neutral-400">{priceSuffix}</span>}</div></div>}
        {waHref
          ? <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={17} /> WhatsApp</a>
          : <a href="#contato" className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--brand)' }}>Tenho interesse</a>}
      </div>

      <footer className="border-t border-black/[0.06] bg-white py-6 text-center text-[12px] text-neutral-400">
        © {site.name || 'Portal'} — feito com LM Flow.
      </footer>
    </div>
  );
}
