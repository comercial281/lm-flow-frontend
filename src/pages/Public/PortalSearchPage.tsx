import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useTenantDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import {
  I, Ic, OrdenarPor, PortalFooter, PortalHeader, PropertyCard, PropertyRow, Select,
  filterProperties, usePortalData, type PortalFilters, type PortalTab,
} from './portalShared';
import PaginaManutencao from './PaginaManutencao';
import { opcaoDoTipo, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { opcoesDePreco, precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { opcaoDoTexto } from '@/features/siteBuilder/public/filtros';
import { FASES } from '@/features/properties/listingKind';
import { usePortalTracking } from './usePortalTracking';
import { useIconeDaAba } from '@/features/siteBuilder/public/useIconeDaAba';
import { ehOrdem, resolverLista, type Ordem } from '@/features/siteBuilder/public/listaConfig';
import { ordenarImoveis } from '@/features/siteBuilder/public/ordenar';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — página dedicada de BUSCA / FILTROS (Produto A).
   Estado de filtro vive na URL (query params) → resultado compartilhável,
   bookmarkável e com botão "voltar" do navegador funcionando. Filtragem é
   client-side sobre o inventário já carregado (mesmo endpoint da home).
──────────────────────────────────────────────────────────────────────────── */

const ROTULO_ABA: Record<PortalTab, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
const MAIS_DE: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

/**
 * Seletor de cidade/bairro: a URL pode vir com "campinas" (vitrine, atalho) e a
 * opção é "Campinas" — marca a equivalente. Sem nenhuma, o valor da URL vira
 * opção: com filtro ativo o campo nunca mostra o rótulo vazio.
 */
function opcoesDeTexto(lista: string[], valor: string): { valor: string; opcoes: [string, string][] } {
  const marcada = opcaoDoTexto(lista, valor);
  const opcoes = lista.map((x): [string, string] => [x, x]);
  return { valor: marcada, opcoes: marcada && !lista.includes(marcada) ? [...opcoes, [marcada, marcada]] : opcoes };
}

/** Espera sem mudança na URL antes de contar a visita da busca. */
const ESPERA_VISITA_MS = 1500;

/**
 * Quantos cards aparecem por vez. O catálogo chega INTEIRO (centenas de
 * imóveis); o "Mostrar mais" evita despejar tudo numa página só. O contador do
 * título continua sendo o total filtrado — é ele que responde "quantos tem".
 */
const RESULTS_PAGE_SIZE = 30;

export default function PortalSearchPage() {
  const tenant = useTenantDoSite();
  const [params, setParams] = useSearchParams();
  const { state, site, items, fontHref, wa, cities, hoods, types, abas, cssVars, manutencao } = usePortalData(tenant);
  const { pathname, search } = useLocation();

  // Uma visita por carga da página, levando os filtros (pathname + query) de quando a URL
  // assentou pela 1ª vez. Mexer nos filtros depois não conta visita nova.
  const caminhoAtual = pathname + search;
  const [caminhoRegistrado, setCaminhoRegistrado] = useState<string | null>(null);
  useEffect(() => {
    if (caminhoRegistrado) return;
    const t = setTimeout(() => setCaminhoRegistrado(caminhoAtual), ESPERA_VISITA_MS);
    return () => clearTimeout(t);
  }, [caminhoAtual, caminhoRegistrado]);
  // Em manutenção nada de rastreamento nem visita: a página é a de manutenção.
  usePortalTracking(state === 'ok' && !manutencao ? site : null, tenant, caminhoRegistrado ? { kind: 'search', path: caminhoRegistrado } : null);
  useIconeDaAba(site.branding?.favicon_url);

  // Só vale aba visível; a da URL que não é (desligada ou sem imóvel) cai na primeira visível.
  const tabDaUrl = params.get('tab') as PortalTab | null;
  const tab: PortalTab = tabDaUrl && abas.includes(tabDaUrl) ? tabDaUrl : (abas[0] ?? 'sale');

  const filters: PortalFilters = useMemo(() => ({
    tab,
    type: params.get('type') || '',
    city: params.get('city') || '',
    neighborhood: params.get('neighborhood') || '',
    bedrooms: params.get('bedrooms') || '',
    code: params.get('code') || '',
    price_min: params.get('price_min') || '',
    price_max: params.get('price_max') || '',
    suites: params.get('suites') || '',
    parking: params.get('parking') || '',
    // Fase escondida em Alugar não filtra (um ?stage= velho na URL zeraria a lista).
    stage: tab === 'rent' ? '' : params.get('stage') || '',
  }), [params, tab]);

  // Atualiza um ou mais filtros na URL. `replace` evita poluir o histórico
  // (usado na digitação do código); os controles discretos empurram histórico
  // para o botão "voltar" restaurar o filtro anterior.
  const update = (patch: Partial<Record<keyof PortalFilters | 'sort', string>>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace });
  };

  // Ordem não é filtro: "Limpar filtros" mantém a escolhida.
  const clearAll = () => {
    const next = new URLSearchParams(filters.tab === 'sale' ? {} : { tab: filters.tab });
    const sort = params.get('sort');
    if (sort) next.set('sort', sort);
    setParams(next, { replace: true });
  };

  // Ordem: a da URL (?sort=) ou, sem ela (ou com um valor que não existe), o
  // padrão do site (Meu site › Lista de imóveis). Servidor velho = Mais recentes.
  const lista = useMemo(() => resolverLista(site.listing), [site.listing]);
  const sortDaUrl = params.get('sort');
  const ordem: Ordem = ehOrdem(sortDaUrl) ? sortDaUrl : lista.default_sort;
  // Escolher o padrão tira o ?sort= da URL: o link fica limpo e segue o site.
  const trocarOrdem = (o: Ordem) => update({ sort: o === lista.default_sort ? '' : o });

  // Filtra, ordena e só então pagina ("Mostrar mais").
  const filtered = useMemo(() => filterProperties(items, filters), [items, filters]);
  const ordenados = useMemo(() => ordenarImoveis(filtered, ordem, filters.tab), [filtered, ordem, filters.tab]);
  const hasActiveFilters = !!(filters.type || filters.city || filters.neighborhood || filters.bedrooms || filters.code
    || filters.price_min || filters.price_max || filters.suites || filters.parking || filters.stage);

  // Aluguel tem faixas de preço próprias: trocar de/para Alugar zera o preço.
  // Alugar não tem empreendimento: a fase escolhida sai junto.
  const trocarAba = (k: PortalTab) => {
    const zerarPreco = (k === 'rent') !== (filters.tab === 'rent') ? { price_min: '', price_max: '' } : {};
    update({ tab: k === 'sale' ? '' : k, ...zerarPreco, ...(k === 'rent' ? { stage: '' } : {}) });
  };
  const cidade = opcoesDeTexto(cities, filters.city);
  const bairro = opcoesDeTexto(hoods, filters.neighborhood);
  const preco = opcoesDePreco(filters.tab, filters.price_min, filters.price_max);

  // Mudou o filtro ou a ordem, a lista recomeça do topo.
  const [visible, setVisible] = useState(RESULTS_PAGE_SIZE);
  useEffect(() => { setVisible(RESULTS_PAGE_SIZE); }, [filters, ordem]);
  const shown = ordenados.slice(0, visible);
  const remaining = ordenados.length - shown.length;

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  // Em manutenção a página de manutenção vem antes do erro e das listas (que dão 404).
  if (manutencao) return <PaginaManutencao site={site} />;
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  return (
    <div style={cssVars as CSSProperties} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} abas={abas} />

      {/* ── Barra de busca / filtros ──────────────────────────────────────── */}
      <section className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">Encontre seu imóvel</h1>
          <div className="mt-4 rounded-[24px] bg-[var(--paper)] p-3 ring-1 ring-black/[0.05] sm:p-4">
            {/* Uma aba só não é escolha: a fileira some. */}
            {abas.length > 1 && <div className="mb-3 flex flex-wrap gap-1.5">
              {abas.map(k => (
                <button key={k} type="button" onClick={() => trocarAba(k)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${filters.tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
                  style={filters.tab === k ? { background: 'var(--brand)' } : undefined}>
                  {ROTULO_ABA[k]}
                </button>
              ))}
            </div>}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={opcaoDoTipo(types, filters.type)} onChange={v => update({ type: v })} label="Tipo" options={opcoesDeTipo(types)} />
              <Select value={cidade.valor} onChange={v => update({ city: v })} label="Cidade" options={cidade.opcoes} />
              <Select value={bairro.valor} onChange={v => update({ neighborhood: v })} label="Bairro" options={bairro.opcoes} />
              <Select value={filters.bedrooms} onChange={v => update({ bedrooms: v })} label="Dormitórios" options={[['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']]} />
              <Select value={preco.valor}
                onChange={v => update({ price_min: '', price_max: '', ...precoDaFaixa(filters.tab, v) })}
                label="Faixa de preço" options={preco.opcoes} />
              <Select value={filters.suites ?? ''} onChange={v => update({ suites: v })} label="Suítes" options={MAIS_DE} />
              <Select value={filters.parking ?? ''} onChange={v => update({ parking: v })} label="Vagas" options={MAIS_DE} />
              {/* Fase é de empreendimento, e Alugar não tem empreendimento. */}
              {filters.tab !== 'rent' && (
                <Select value={filters.stage ?? ''} onChange={v => update({ stage: v })} label="Fase" options={FASES.map(x => [x.valor, x.rotulo])} />
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
                <button type="button" onClick={() => setVisible(v => v + RESULTS_PAGE_SIZE)}
                  className="rounded-full px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--ink)' }}>
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
