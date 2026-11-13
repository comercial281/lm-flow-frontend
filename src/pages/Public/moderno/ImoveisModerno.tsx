import { OrdenarPor, type PortalFilters } from '../portalShared';
import { AREAS_MINIMAS } from '@/features/siteBuilder/public/filtros';
import { opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { rotuloDaFase } from '@/features/properties/listingKind';
import type { BuscaDosImoveis, PatchDaBusca } from '../busca/useBuscaDosImoveis';
import FiltrosModernos from './FiltrosModernos';
import CartaoClaro, { CartaoClaroDeitado } from './CartaoClaro';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Página de Imóveis (busca) do Moderno (spec 7 "Imóveis"; protótipo
   `#imoveis`): título, painel de filtros, barra de resultados com os filtros
   ativos em pílulas removíveis e a ordem, grade de cartões claros (ou deitados
   com Lista de imóveis › em linhas) e "Mostrar mais". Tudo o que muda a lista
   é o `useBuscaDosImoveis` do Clássico: mesma URL, mesma ordem, mesma visita.
──────────────────────────────────────────────────────────────────────────── */

interface Pilula { chave: string; texto: string; tirar: PatchDaBusca }

const mais = (n: string, um: string, varios: string) => `${n}+ ${n === '1' ? um : varios}`;

/** Os filtros ativos, na ordem do painel, cada um com o que tirar da URL. */
function pilulasDosFiltros(f: PortalFilters, busca: BuscaDosImoveis): Pilula[] {
  const { types, cidade, bairro, preco } = busca;
  const p: (Pilula | null)[] = [
    f.condominium ? { chave: 'condominium', texto: `Condomínio ${f.condominium}`, tirar: { condominium: '' } } : null,
    f.place ? { chave: 'place', texto: `“${f.place}”`, tirar: { place: '' } } : null,
    f.type ? { chave: 'type', texto: opcoesDeTipo(types).find(([v]) => v === f.type)?.[1] ?? opcoesDeTipo([f.type])[0][1], tirar: { type: '' } } : null,
    f.city ? { chave: 'city', texto: cidade.valor || f.city, tirar: { city: '' } } : null,
    f.neighborhood ? { chave: 'neighborhood', texto: bairro.valor || f.neighborhood, tirar: { neighborhood: '' } } : null,
    f.bedrooms ? { chave: 'bedrooms', texto: mais(f.bedrooms, 'dormitório', 'dormitórios'), tirar: { bedrooms: '' } } : null,
    f.price_min || f.price_max
      ? { chave: 'price', texto: preco.opcoes.find(([v]) => v === preco.valor)?.[1] ?? 'Faixa de preço', tirar: { price_min: '', price_max: '' } }
      : null,
    f.area ? { chave: 'area', texto: AREAS_MINIMAS.find(([v]) => v === f.area)?.[1] ?? `${f.area} m²+`, tirar: { area: '' } } : null,
    f.suites ? { chave: 'suites', texto: mais(f.suites, 'suíte', 'suítes'), tirar: { suites: '' } } : null,
    f.parking ? { chave: 'parking', texto: mais(f.parking, 'vaga', 'vagas'), tirar: { parking: '' } } : null,
    f.stage ? { chave: 'stage', texto: rotuloDaFase(f.stage), tirar: { stage: '' } } : null,
    f.code ? { chave: 'code', texto: `Código ${f.code}`, tirar: { code: '' } } : null,
  ];
  return p.filter((x): x is Pilula => !!x);
}

export default function ImoveisModerno({ busca, tenant }: { busca: BuscaDosImoveis; tenant: string }) {
  const {
    listaOk, filters, update, clearAll, hasActiveFilters, lista, ordem, trocarOrdem,
    filtered, shown, remaining, mostrarMais, wa,
  } = busca;
  const pilulas = pilulasDosFiltros(filters, busca);
  const Cartao = lista.card_layout === 'rows' ? CartaoClaroDeitado : CartaoClaro;
  const total = filtered.length;

  return (
    <main data-pagina-moderna="imoveis" className="px-4 pb-[clamp(56px,8vw,96px)]">
      <div className={MIOLO}>
        <h1 className="pb-[22px] pt-[clamp(36px,5vw,64px)] font-[var(--display)] text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance]">
          {listaOk ? listaOk.titulo : 'Encontre seu imóvel'}
        </h1>

        <FiltrosModernos busca={busca} />

        <div className="mb-4 mt-7 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[var(--display)] text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.02em] text-[var(--m-head)]">
              {total} {total !== 1 ? 'imóveis' : 'imóvel'} encontrado{total !== 1 ? 's' : ''}
            </h2>
            {pilulas.length > 0 && (
              <ul aria-label="Filtros ativos" className="mt-2 flex flex-wrap items-center gap-1.5">
                {pilulas.map(pl => (
                  <li key={pl.chave} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-brand-soft)] py-1 pl-3 pr-1.5 text-[12.5px] font-semibold text-[var(--m-head)]">
                    {pl.texto}
                    <button
                      type="button" aria-label={`Tirar o filtro ${pl.texto}`} onClick={() => update(pl.tirar)}
                      className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--m-surface)] text-[11px] leading-none"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {hasActiveFilters && pilulas.length > 1 && (
                  <li>
                    <button type="button" onClick={clearAll} className="px-1.5 text-[12.5px] font-semibold text-[var(--m-head)] underline">Limpar filtros</button>
                  </li>
                )}
              </ul>
            )}
          </div>
          {/* Com um imóvel só, não há o que ordenar. */}
          {total > 1 && <OrdenarPor valor={ordem} onChange={trocarOrdem} moderno />}
        </div>

        {total === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[var(--m-line)] py-16 text-center text-[var(--m-muted)]">
            Nenhum imóvel com esses filtros.{' '}
            <button type="button" onClick={clearAll} className="font-semibold text-[var(--m-head)] underline">Limpar filtros</button>
          </div>
        ) : (
          <>
            <div className={lista.card_layout === 'rows' ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
              {shown.map(p => <Cartao key={p.id} tenant={tenant} p={p} wa={wa} tab={filters.tab} />)}
            </div>
            {remaining > 0 && (
              <div className="mt-7 flex flex-col items-center gap-2 text-[12.5px] text-[var(--m-muted)]">
                <button
                  type="button" onClick={mostrarMais}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-6 py-3 text-[14px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px"
                >
                  Mostrar mais imóveis
                </button>
                <span>Mostrando {shown.length} de {total}</span>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
