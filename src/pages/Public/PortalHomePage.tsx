import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';
import {
  API, I, Ic, PROPERTY_TYPE_LABEL, PortalFooter, PortalHeader, PropertyCard, Select, Stat,
  usePortalData, type PortalTab,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — HOME (Produto A do LM Flow)
   Template "Editorial Estate": moderno, mobile-first, focado na conversão do
   lead. TUDO é dirigido pelos tokens de marca do cliente (logo, cores, fonte,
   WhatsApp), vindos do registro do Site. Zero marca hardcoded.

   A busca desta home é o ponto de ENTRADA: o formulário do hero leva à página
   dedicada de busca/filtros (`/portal/:tenant/imoveis`), assim como os botões
   do menu do topo (em PortalHeader). Aqui a listagem é apenas uma vitrine de
   destaques.
──────────────────────────────────────────────────────────────────────────── */

export default function PortalHomePage() {
  const { tenant } = useParams<{ tenant: string }>();
  const navigate = useNavigate();
  const { state, site, items, fontHref, wa, cities, hoods, types, cssVars } = usePortalData(tenant);

  // filtros do formulário do hero (entrada da busca)
  const [tab, setTab] = useState<PortalTab>('sale');
  const [fType, setFType] = useState('');
  const [fCity, setFCity] = useState('');
  const [fNeighborhood, setFNeighborhood] = useState('');
  const [fBedrooms, setFBedrooms] = useState('');
  const [fCode, setFCode] = useState('');

  // lead capture
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadPhoneErr, setLeadPhoneErr] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  // Vitrine de destaques (com fallback para os primeiros imóveis).
  const featured = useMemo(() => {
    const f = items.filter(p => p.featured || p.exclusive);
    return (f.length ? f : items).slice(0, 6);
  }, [items]);

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab !== 'sale') params.set('tab', tab);
    if (fType) params.set('type', fType);
    if (fCity) params.set('city', fCity);
    if (fNeighborhood) params.set('neighborhood', fNeighborhood);
    if (fBedrooms) params.set('bedrooms', fBedrooms);
    if (fCode) params.set('code', fCode);
    const qs = params.toString();
    navigate(`/portal/${tenant}/imoveis${qs ? `?${qs}` : ''}`);
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

  // Seções liga/desliga (Site Builder). Ausência da flag = visível (retrocompat).
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      {/* Fonte do site (definida no Site Builder) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} onHome />

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

          {/* Busca (entrada → página dedicada de filtros) */}
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

      {/* ── Destaques ─────────────────────────────────────────────────── */}
      <section id="resultados" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selecionados a dedo</span>
            <h2 className="mt-1 font-[var(--display)] text-3xl font-semibold sm:text-4xl">Imóveis em destaque</h2>
          </div>
          <Link to={`/portal/${tenant}/imoveis`} className="hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:inline-flex" style={{ background: 'var(--ink)' }}>
            Ver todos os imóveis <Ic d={I.arrow} s={16} />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-16 text-center text-neutral-500">
            Nenhum imóvel disponível no momento.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(p => <PropertyCard key={p.id} tenant={tenant!} p={p} wa={wa} />)}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link to={`/portal/${tenant}/imoveis`} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--ink)' }}>
                Ver todos os imóveis <Ic d={I.arrow} s={16} />
              </Link>
            </div>
          </>
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

      <PortalFooter site={site} tenant={tenant!} onHome />
    </div>
  );
}
