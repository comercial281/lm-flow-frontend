import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { I, Ic, Select, type PortalProperty, type SiteInfo } from '../portalShared';
import { opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { CAMPOS_BUSCA, TITULO_CAPA_FABRICA, type AbaId, type CampoBusca, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { faixasDePreco, precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { FASES } from '@/features/properties/listingKind';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   Capa da página inicial: foto/vídeo, título, subtítulo e a busca rápida.
   Abas e campos vêm do Personalizar (home.search); a busca é só a ENTRADA —
   ela leva à página dedicada (`/portal/:tenant/imoveis`) com os filtros na URL.
──────────────────────────────────────────────────────────────────────────── */

const ROTULO_ABA: Record<AbaId, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
const SUBTITULO_PADRAO = 'Apartamentos, casas e lançamentos com curadoria, fotos reais e atendimento humano de verdade.';
const CAPA_PADRAO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80';
const ATE_4: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']];
const ATE_3: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

interface Props {
  site: SiteInfo;
  home: HomeConfig;
  items: PortalProperty[];
  tenant: string;
  abas: AbaId[];
  cities: string[];
  hoods: string[];
  types: string[];
  /** Avisado quando a pessoa troca de aba (a captura de contato acompanha). */
  onTab?: (tab: AbaId) => void;
}

export default function HomeCapa({ site, home, items, tenant, abas, cities, hoods, types, onTab }: Props) {
  const navigate = useNavigate();
  const ctx = useCtxDoSite(tenant);
  // Sem aba visível (catálogo vazio ou todas desligadas), a busca cai em Comprar.
  const [tab, setTab] = useState<AbaId>(abas[0] ?? 'sale');
  const [valores, setValores] = useState<Partial<Record<CampoBusca, string>>>({});
  const set = (k: CampoBusca) => (v: string) => setValores(s => ({ ...s, [k]: v }));

  // Fase é de empreendimento, e Alugar não tem empreendimento: o campo some nessa aba.
  const campos = CAMPOS_BUSCA.filter(c => home.search.fields.includes(c) && !(c === 'stage' && tab === 'rent'));
  const selects = campos.filter(c => c !== 'code');
  const temCodigo = campos.includes('code');

  const trocarAba = (k: AbaId) => {
    // As faixas de preço do aluguel são outras: a faixa marcada não vale mais.
    if (faixasDePreco(k) !== faixasDePreco(tab)) setValores(s => ({ ...s, price: '' }));
    if (k === 'rent') setValores(s => ({ ...s, stage: '' }));
    setTab(k);
    onTab?.(k);
  };

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab !== 'sale') params.set('tab', tab);
    for (const c of campos) {
      const v = valores[c];
      if (!v) continue;
      if (c === 'price') {
        for (const [k, n] of Object.entries(precoDaFaixa(tab, v))) params.set(k, n);
      } else {
        params.set(c, v);
      }
    }
    const qs = params.toString();
    navigate(caminhoDoSite(ctx, `/imoveis${qs ? `?${qs}` : ''}`));
  };

  const opcoes: Record<Exclude<CampoBusca, 'code'>, { label: string; options: [string, string][] }> = {
    type: { label: 'Tipo', options: opcoesDeTipo(types) },
    city: { label: 'Cidade', options: cities.map(c => [c, c]) },
    neighborhood: { label: 'Bairro', options: hoods.map(h => [h, h]) },
    price: { label: 'Faixa de preço', options: faixasDePreco(tab).map(f => [f.valor, f.rotulo]) },
    bedrooms: { label: 'Dormitórios', options: ATE_4 },
    suites: { label: 'Suítes', options: ATE_3 },
    parking: { label: 'Vagas', options: ATE_3 },
    stage: { label: 'Fase', options: FASES.map(f => [f.valor, f.rotulo]) },
  };

  const titulo = home.search.title?.trim() || TITULO_CAPA_FABRICA;
  const subtitulo = home.search.subtitle?.trim() || site.seo?.description || SUBTITULO_PADRAO;

  return (
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
          // Foto escolhida no Site Builder (de um imóvel ou enviada); sem ela,
          // a capa do primeiro imóvel da lista, como sempre foi.
          <img src={site.hero?.image_url || items[0]?.cover_url || CAPA_PADRAO} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(23,20,15,0.35) 0%, rgba(23,20,15,0.55) 55%, var(--paper) 100%)' }} />
      </div>

      {/* pt maior: o cabeçalho FLUTUA sobre a capa (ele sai do fluxo), então o
          título precisa do espaço dele de volta. */}
      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-32 sm:px-6 sm:pt-40 md:pb-16 md:pt-44">
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/80">{site.name || 'Portal Imobiliário'}</p>
        <h1 className="mt-3 max-w-2xl font-[var(--display)] text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl">
          {titulo}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">{subtitulo}</p>

        {/* Busca (entrada → página dedicada de filtros) */}
        <form onSubmit={runSearch} className="mt-8 rounded-[24px] bg-white/95 p-3 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)] backdrop-blur sm:p-4">
          {/* Uma aba só não é escolha: a fileira some. */}
          {abas.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {abas.map(k => (
                <button key={k} type="button" onClick={() => trocarAba(k)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
                  style={tab === k ? { background: 'var(--brand)' } : undefined}>
                  {ROTULO_ABA[k]}
                </button>
              ))}
            </div>
          )}

          {selects.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {selects.map(c => {
                const o = opcoes[c as Exclude<CampoBusca, 'code'>];
                return <Select key={c} value={valores[c] ?? ''} onChange={set(c)} label={o.label} options={o.options} />;
              })}
            </div>
          )}

          <div className={`flex flex-col gap-2 sm:flex-row ${selects.length > 0 ? 'mt-2' : ''}`}>
            {temCodigo && (
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Ic d={I.search} s={17} /></span>
                <input value={valores.code ?? ''} onChange={e => set('code')(e.target.value)} placeholder="Buscar por código do imóvel"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)]" />
              </div>
            )}
            <button type="submit" className={`inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 ${temCodigo ? '' : 'sm:ml-auto'}`} style={{ background: 'var(--brand)' }}>
              <Ic d={I.search} s={17} /> Buscar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
