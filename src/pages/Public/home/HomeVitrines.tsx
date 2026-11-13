import { Link } from 'react-router-dom';
import { I, Ic, PropertyCard, type PortalProperty } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { abaDaVitrine, verTodosDaVitrine, vitrinesVisiveis } from '@/features/siteBuilder/public/vitrines';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { semAsteriscos } from '@/features/siteBuilder/public/destaqueNoTitulo';

/* ────────────────────────────────────────────────────────────────────────────
   Vitrines da página inicial: as de fábrica (Lançamentos, Imóveis em destaque)
   e as livres do Personalizar. Vitrine sem imóvel some; sem nenhuma, o bloco
   inteiro some — nada de título solto.
──────────────────────────────────────────────────────────────────────────── */

interface Props {
  home: HomeConfig; items: PortalProperty[]; tenant: string; wa?: string | null; abas: AbaId[];
  /** Aparência › cartões grandes: duas colunas a partir do md e o cartão grande. */
  cartoesGrandes?: boolean;
}

export default function HomeVitrines({ home, items, tenant, wa, abas, cartoesGrandes = false }: Props) {
  const ctx = useCtxDoSite(tenant);
  const lista = vitrinesVisiveis(home, items);
  if (lista.length === 0) return null;

  return (
    <div id="resultados">
      {lista.map(({ vitrine, itens }) => {
        const link = verTodosDaVitrine(vitrine, abas, ctx);
        const tab = abaDaVitrine(vitrine);
        const temLink = link !== null;
        const verTodos = link?.href ?? '';
        const rotuloLink = link?.rotulo;
        return (
          <section key={vitrine.id} className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                {vitrine.kind === 'featured' && (
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selecionados a dedo</span>
                )}
                <h2 className={`${vitrine.kind === 'featured' ? 'mt-1 ' : ''}font-[var(--display)] text-3xl font-semibold sm:text-4xl`}>{semAsteriscos(vitrine.title)}</h2>
              </div>
              {temLink && <Link to={verTodos} className="hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:inline-flex" style={{ background: 'var(--solid)' }}>
                {rotuloLink} <Ic d={I.arrow} s={16} />
              </Link>}
            </div>

            <div className={cartoesGrandes ? 'grid grid-cols-1 gap-5 md:grid-cols-2' : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
              {itens.map(p => <PropertyCard key={p.id} tenant={tenant} p={p} wa={wa} tab={tab} grande={cartoesGrandes} />)}
            </div>
            {temLink && <div className="mt-8 text-center sm:hidden">
              <Link to={verTodos} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--solid)' }}>
                {rotuloLink} <Ic d={I.arrow} s={16} />
              </Link>
            </div>}
          </section>
        );
      })}
    </div>
  );
}
