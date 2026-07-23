import { useMemo, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  I, Ic, PROPERTY_TYPE_LABEL, PortalFooter, PortalHeader, PropertyCard, Select,
  filterProperties, usePortalData, type PortalFilters, type PortalTab,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — página dedicada de BUSCA / FILTROS (Produto A).
   Estado de filtro vive na URL (query params) → resultado compartilhável,
   bookmarkável e com botão "voltar" do navegador funcionando. Filtragem é
   client-side sobre o inventário já carregado (mesmo endpoint da home).
──────────────────────────────────────────────────────────────────────────── */

const TABS: [PortalTab, string][] = [['sale', 'Comprar'], ['rent', 'Alugar'], ['launch', 'Lançamentos']];

export default function PortalSearchPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [params, setParams] = useSearchParams();
  const { state, site, items, fontHref, wa, cities, hoods, types, cssVars } = usePortalData(tenant);

  const filters: PortalFilters = useMemo(() => ({
    tab: (params.get('tab') as PortalTab) || 'sale',
    type: params.get('type') || '',
    city: params.get('city') || '',
    neighborhood: params.get('neighborhood') || '',
    bedrooms: params.get('bedrooms') || '',
    code: params.get('code') || '',
  }), [params]);

  // Atualiza um ou mais filtros na URL. `replace` evita poluir o histórico
  // (usado na digitação do código); os controles discretos empurram histórico
  // para o botão "voltar" restaurar o filtro anterior.
  const update = (patch: Partial<Record<keyof PortalFilters, string>>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace });
  };

  const clearAll = () => setParams(new URLSearchParams(filters.tab === 'sale' ? {} : { tab: filters.tab }), { replace: true });

  const filtered = useMemo(() => filterProperties(items, filters), [items, filters]);
  const hasActiveFilters = !!(filters.type || filters.city || filters.neighborhood || filters.bedrooms || filters.code);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  return (
    <div style={cssVars as CSSProperties} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} />

      {/* ── Barra de busca / filtros ──────────────────────────────────────── */}
      <section className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">Encontre seu imóvel</h1>
          <div className="mt-4 rounded-[24px] bg-[var(--paper)] p-3 ring-1 ring-black/[0.05] sm:p-4">
            <div className="mb-3 flex gap-1.5">
              {TABS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => update({ tab: k === 'sale' ? '' : k })}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${filters.tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
                  style={filters.tab === k ? { background: 'var(--brand)' } : undefined}>
                  {l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={filters.type} onChange={v => update({ type: v })} label="Tipo" options={types.map(t => [t, PROPERTY_TYPE_LABEL[t] || t])} />
              <Select value={filters.city} onChange={v => update({ city: v })} label="Cidade" options={cities.map(c => [c, c])} />
              <Select value={filters.neighborhood} onChange={v => update({ neighborhood: v })} label="Bairro" options={hoods.map(h => [h, h])} />
              <Select value={filters.bedrooms} onChange={v => update({ bedrooms: v })} label="Dormitórios" options={[['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']]} />
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
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Resultados</span>
            <h2 className="mt-1 font-[var(--display)] text-2xl font-semibold sm:text-3xl">
              {filtered.length} {filtered.length !== 1 ? 'imóveis' : 'imóvel'} encontrado{filtered.length !== 1 ? 's' : ''}
            </h2>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearAll} className="shrink-0 text-[13px] font-semibold text-[var(--brand)] underline">Limpar filtros</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 py-16 text-center text-neutral-500">
            Nenhum imóvel com esses filtros. <button type="button" onClick={clearAll} className="font-semibold text-[var(--brand)] underline">Limpar filtros</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => <PropertyCard key={p.id} tenant={tenant!} p={p} wa={wa} />)}
          </div>
        )}
      </section>

      <PortalFooter site={site} tenant={tenant!} />
    </div>
  );
}
