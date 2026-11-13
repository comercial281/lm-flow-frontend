import { type CSSProperties } from 'react';
import { useTenantDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import {
  I, Ic, OrdenarPor, PortalFooter, PortalHeader, PropertyCard, PropertyRow, Select, type PortalTab,
} from './portalShared';
import CampoDeLugar from './CampoDeLugar';
import PaginaManutencao from './PaginaManutencao';
import PaginaNaoEncontrada from './PaginaNaoEncontrada';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { opcaoDoTipo, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { FASES_DO_PUBLICO } from '@/features/properties/listingKind';
import { AREAS_MINIMAS } from '@/features/siteBuilder/public/filtros';
import { useBuscaDosImoveis } from './busca/useBuscaDosImoveis';
import { resolverAparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import ImoveisModerno from './moderno/ImoveisModerno';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — página dedicada de BUSCA / FILTROS (Produto A).
   A lógica (filtros na URL, lista do servidor, ordem, "Mostrar mais", visita
   e rastreamento) mora em `useBuscaDosImoveis`; aqui só o desenho Clássico.
──────────────────────────────────────────────────────────────────────────── */

const ROTULO_ABA: Record<PortalTab, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
const MAIS_DE: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

export default function PortalSearchPage() {
  const tenant = useTenantDoSite();
  const busca = useBuscaDosImoveis(tenant);
  const {
    state, site, fontHrefs, wa, types, abas, cssVars, fundo, manutencao, ctx, chave, listaDoServidor, listaOk,
    filters, update, clearAll, hasActiveFilters, trocarAba, lista, ordem, trocarOrdem,
    filtered, shown, remaining, mostrarMais, cidade, bairro, preco,
    items, textoDoLugar, setTextoDoLugar, escolherLugar, confirmarLugar, limparLugar,
  } = busca;

  if (state === 'loading' || listaDoServidor === undefined) {
    return <div data-carregando className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  // Em manutenção a página de manutenção vem antes do erro e das listas (que dão 404).
  if (manutencao) return <PaginaManutencao site={site} />;
  if (state === 'error' || listaDoServidor === 'erro') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }
  if (listaDoServidor === null && chave) return <PaginaNaoEncontrada inicio={caminhoDoSite(ctx, '/')} imoveis={caminhoDoSite(ctx, '/imoveis')} />;

  // Moderno: outro desenho, com a mesma busca (URL, ordem, visita).
  if (resolverAparencia(site.appearance).style === 'modern') {
    return (
      <div style={cssVars as CSSProperties} data-fundo={fundo} className="min-h-screen bg-[var(--m-ground)] text-[var(--m-text)] antialiased">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}
        <PortalHeader site={site} tenant={tenant!} abas={abas} />
        <ImoveisModerno busca={busca} tenant={tenant!} />
        <PortalFooter site={site} tenant={tenant!} abas={abas} />
      </div>
    );
  }

  return (
    <div style={cssVars as CSSProperties} data-fundo={fundo} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}

      <PortalHeader site={site} tenant={tenant!} abas={abas} />

      {/* ── Barra de busca / filtros ──────────────────────────────────────── */}
      <section className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">{listaOk ? listaOk.titulo : 'Encontre seu imóvel'}</h1>
          <div className="mt-4 rounded-[24px] bg-[var(--paper)] p-3 ring-1 ring-black/[0.05] sm:p-4">
            {/* Uma aba só não é escolha: a fileira some. */}
            {/* Na lista o negócio já é o do caminho: trocar de aba esvaziaria a lista. */}
            {abas.length > 1 && !listaOk && <div className="mb-3 flex flex-wrap gap-1.5">
              {abas.map(k => (
                <button key={k} type="button" onClick={() => trocarAba(k)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${filters.tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
                  style={filters.tab === k ? { background: 'var(--brand)' } : undefined}>
                  {ROTULO_ABA[k]}
                </button>
              ))}
            </div>}

            <CampoDeLugar className="mb-2" items={items} tab={filters.tab} texto={textoDoLugar}
              onTexto={setTextoDoLugar} onEscolher={escolherLugar} onConfirmar={confirmarLugar} onLimpar={limparLugar} />

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={opcaoDoTipo(types, filters.type)} onChange={v => update({ type: v })} label="Tipo" options={opcoesDeTipo(types)} />
              <Select value={cidade.valor} onChange={v => update({ city: v })} label="Cidade" options={cidade.opcoes} />
              <Select value={bairro.valor} onChange={v => update({ neighborhood: v })} label="Bairro" options={bairro.opcoes} />
              <Select value={filters.bedrooms} onChange={v => update({ bedrooms: v })} label="Dormitórios" options={[['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']]} />
              <Select value={preco.valor}
                onChange={v => update({ price_min: '', price_max: '', ...precoDaFaixa(filters.tab, v) })}
                label="Faixa de preço" options={preco.opcoes} />
              <Select value={filters.area ?? ''} onChange={v => update({ area: v })} label="Área" options={AREAS_MINIMAS} />
              <Select value={filters.suites ?? ''} onChange={v => update({ suites: v })} label="Suítes" options={MAIS_DE} />
              <Select value={filters.parking ?? ''} onChange={v => update({ parking: v })} label="Vagas" options={MAIS_DE} />
              {/* Fase é de empreendimento, e Alugar não tem empreendimento. */}
              {filters.tab !== 'rent' && (
                <Select value={filters.stage ?? ''} onChange={v => update({ stage: v })} label="Fase" options={FASES_DO_PUBLICO.map(x => [x.valor, x.rotulo])} />
              )}
            </div>

            <div className="mt-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Ic d={I.search} s={17} /></span>
                <input value={filters.code} onChange={e => update({ code: e.target.value }, true)} placeholder="Buscar por código do imóvel"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Resultados</span>
            <h2 className="mt-1 font-[var(--display)] text-2xl font-semibold sm:text-3xl">
              {filtered.length} {filtered.length !== 1 ? 'imóveis' : 'imóvel'} encontrado{filtered.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {hasActiveFilters && (
              <button type="button" onClick={clearAll} className="shrink-0 text-[13px] font-semibold text-[var(--brand)] underline">Limpar filtros</button>
            )}
            {/* Com um imóvel só, não há o que ordenar. */}
            {filtered.length > 1 && <OrdenarPor valor={ordem} onChange={trocarOrdem} />}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-16 text-center text-neutral-500">
            Nenhum imóvel com esses filtros. <button type="button" onClick={clearAll} className="font-semibold text-[var(--brand)] underline">Limpar filtros</button>
          </div>
        ) : (
          <>
            {/* Cartões em grade (padrão) ou em linhas largas (Meu site › Lista de imóveis). */}
            {lista.card_layout === 'rows' ? (
              <div className="flex flex-col gap-4">
                {shown.map(p => <PropertyRow key={p.id} tenant={tenant!} p={p} wa={wa} tab={filters.tab} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map(p => <PropertyCard key={p.id} tenant={tenant!} p={p} wa={wa} tab={filters.tab} />)}
              </div>
            )}
            {remaining > 0 && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <button type="button" onClick={mostrarMais}
                  className="rounded-full px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--solid)' }}>
                  Mostrar mais imóveis
                </button>
                <span className="text-[13px] text-neutral-500">Mostrando {shown.length} de {filtered.length}</span>
              </div>
            )}
          </>
        )}
      </section>

      <PortalFooter site={site} tenant={tenant!} abas={abas} />
    </div>
  );
}
