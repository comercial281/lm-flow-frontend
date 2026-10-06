import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenantDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { TEXTO_ENVIO_NA_PREVIA, cabecalhosDoSite, ehPrevia, envioFoiPrevia } from '@/features/siteBuilder/public/previa';
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';
import { API, PortalFooter, PortalHeader, Stat, usePortalData } from './portalShared';
import PaginaManutencao from './PaginaManutencao';
import FinalidadeChoice from './FinalidadeChoice';
import { finalidadeInicial, type Finalidade } from './finalidade';
import { usePortalTracking } from './usePortalTracking';
import { useIconeDaAba } from '@/features/siteBuilder/public/useIconeDaAba';
import { trackLead } from '@/features/siteBuilder/public/siteTracking';
import HomeCapa from './home/HomeCapa';
import HomeVitrines from './home/HomeVitrines';
import HomeChamadas from './home/HomeChamadas';
import HomeMaisBuscados from './home/HomeMaisBuscados';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — HOME (Produto A do LM Flow)
   Template "Editorial Estate": moderno, mobile-first, focado na conversão do
   lead. TUDO é dirigido pelos tokens de marca do cliente (logo, cores, fonte,
   WhatsApp), vindos do registro do Site. Zero marca hardcoded.

   A página é montada por BLOCOS configurados no Personalizar (settings.home),
   nesta ordem: capa com busca · vitrines · chamadas · mais buscados · números
   · captura de contato · rodapé. Cada bloco some sozinho quando não tem o que
   mostrar. A busca da capa é só a ENTRADA: leva à página dedicada de
   busca/filtros (`/portal/:tenant/imoveis`), como os botões do menu do topo.
──────────────────────────────────────────────────────────────────────────── */

export default function PortalHomePage() {
  const tenant = useTenantDoSite();
  const { state, site, items, fontHrefs, wa, cities, hoods, types, home, abas, cssVars, fundo, aparencia, manutencao } = usePortalData(tenant);
  const { pathname } = useLocation();
  // Em manutenção nada de rastreamento nem visita: a página é a de manutenção.
  usePortalTracking(state === 'ok' && !manutencao ? site : null, tenant, { kind: 'home', path: pathname });
  useIconeDaAba(site.branding?.favicon_url);

  // lead capture
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadPhoneErr, setLeadPhoneErr] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  // Envio feito na prévia: o servidor não criou nada, e a tela não finge que criou.
  const [enviadoNaPrevia, setEnviadoNaPrevia] = useState(false);
  // "Quero comprar / Quero alugar" (spec venda/locação, D3): marcado pela aba da
  // busca do topo, e a pessoa troca se quiser. Sem escolha ainda, segue a aba
  // em que a capa abre (a primeira visível).
  const [escolhaFinalidade, setEscolhaFinalidade] = useState<Finalidade | null>(null);
  const leadFinalidade = escolhaFinalidade ?? finalidadeInicial(abas[0]);

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !leadName.trim()) return;
    if (!isValidBrPhone(leadPhone)) { setLeadPhoneErr(true); return; }
    try {
      const res = await fetch(`${API}/api/public/v1/site/leads`, {
        method: 'POST',
        headers: cabecalhosDoSite(tenant, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lead: { name: leadName, phone: leadPhone, source: 'portal', form_type: 'home', finalidade: leadFinalidade, message: 'Quero ajuda pra encontrar um imóvel (portal home).' } }),
      });
      const naPrevia = ehPrevia(site) || (res.ok && (await envioFoiPrevia(res)));
      setEnviadoNaPrevia(naPrevia);
      setLeadSent(true);
      // Conversão só conta quando o servidor aceitou o contato (e nunca na prévia).
      if (res.ok && !naPrevia) trackLead();
    } catch { /* silencioso */ }
  };

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  // Em manutenção a página de manutenção vem antes do erro e das listas (que dão 404).
  if (manutencao) return <PaginaManutencao site={site} />;
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  // Seções liga/desliga (Site Builder). Ausência da flag = visível (retrocompat).
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;

  return (
    <div style={cssVars} data-fundo={fundo} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      {/* Fonte do site (definida no Site Builder) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}

      <PortalHeader site={site} tenant={tenant!} onHome abas={abas} />

      <HomeCapa
        site={site} home={home} items={items} tenant={tenant!} abas={abas}
        cities={cities} hoods={hoods} types={types}
        onTab={k => { if (k !== 'launch') setEscolhaFinalidade(finalidadeInicial(k)); }}
      />
      <HomeVitrines home={home} items={items} tenant={tenant!} wa={wa} abas={abas} cartoesGrandes={aparencia.card_style === 'large'} />
      <HomeChamadas site={site} tenant={tenant!} home={home} />
      <HomeMaisBuscados home={home} items={items} tenant={tenant!} abas={abas} />

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
        <div className="overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14" style={{ background: 'var(--solid)' }}>
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="text-white">
              <h2 className="font-[var(--display)] text-3xl font-semibold leading-tight sm:text-4xl">Não achou? A gente encontra pra você.</h2>
              <p className="mt-3 max-w-md text-[15px] text-white/70">Deixe seu contato e um especialista traz opções que combinam com o que você procura — sem robô, sem enrolação.</p>
            </div>
            {leadSent && enviadoNaPrevia ? (
              <div role="status" className="rounded-2xl bg-amber-400 p-8 text-center font-semibold text-neutral-900">
                {TEXTO_ENVIO_NA_PREVIA}
              </div>
            ) : leadSent ? (
              <div className="rounded-2xl bg-white/10 p-8 text-center text-white ring-1 ring-white/15">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-lg font-semibold">Recebemos seu contato!</p>
                <p className="mt-1 text-white/70">Um especialista vai te chamar em breve.</p>
              </div>
            ) : (
              <form onSubmit={submitLead} className="rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-4"><FinalidadeChoice value={leadFinalidade} onChange={setEscolhaFinalidade} /></div>
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

      <PortalFooter site={site} tenant={tenant!} onHome abas={abas} />
    </div>
  );
}
