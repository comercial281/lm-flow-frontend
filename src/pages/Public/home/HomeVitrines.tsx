import { Link } from 'react-router-dom';
import { I, Ic, PropertyCard, type PortalProperty, type PortalTab } from '../portalShared';
import type { AbaId, HomeConfig, Vitrine } from '@/features/siteBuilder/public/homeConfig';
import { buscaDaRegra, vitrinesVisiveis } from '@/features/siteBuilder/public/vitrines';

/* ────────────────────────────────────────────────────────────────────────────
   Vitrines da página inicial: as de fábrica (Lançamentos, Imóveis em destaque)
   e as livres do Personalizar. Vitrine sem imóvel some; sem nenhuma, o bloco
   inteiro some — nada de título solto.
──────────────────────────────────────────────────────────────────────────── */

/** Aba que o cartão leva para a página do imóvel. */
function abaDaVitrine(v: Vitrine): PortalTab {
  if (v.kind === 'launches') return 'launch';
  if (v.kind === 'custom' && v.rules?.transaction === 'rent') return 'rent';
  return 'sale';
}

/** Query string do "Ver todos": a busca que traz o mesmo recorte. */
function buscaDaVitrine(v: Vitrine): string {
  if (v.kind === 'launches') return 'tab=launch';
  if (v.kind === 'custom' && v.rules) return buscaDaRegra(v.rules);
  return '';
}

interface Props { home: HomeConfig; items: PortalProperty[]; tenant: string; wa?: string | null; abas: AbaId[] }

export default function HomeVitrines({ home, items, tenant, wa, abas }: Props) {
  const lista = vitrinesVisiveis(home, items);
  if (lista.length === 0) return null;

  return (
    <div id="resultados">
      {lista.map(({ vitrine, itens }) => {
        const q = buscaDaVitrine(vitrine);
        const verTodos = `/portal/${tenant}/imoveis${q ? `?${q}` : ''}`;
        const tab = abaDaVitrine(vitrine);
        // O "Ver todos" que cai numa aba escondida levaria a uma busca que não é a da vitrine: sem o link.
        const abaDoLink = new URLSearchParams(q).get('tab');
        const temLink = abas.includes((abaDoLink ?? 'sale') as AbaId);
        return (
          <section key={vitrine.id} className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                {vitrine.kind === 'featured' && (
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selecionados a dedo</span>
                )}
                <h2 className={`${vitrine.kind === 'featured' ? 'mt-1 ' : ''}font-[var(--display)] text-3xl font-semibold sm:text-4xl`}>{vitrine.title}</h2>
              </div>
              {temLink && <Link to={verTodos} className="hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:inline-flex" style={{ background: 'var(--ink)' }}>
                Ver todos <Ic d={I.arrow} s={16} />
              </Link>}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map(p => <PropertyCard key={p.id} tenant={tenant} p={p} wa={wa} tab={tab} />)}
            </div>
            {temLink && <div className="mt-8 text-center sm:hidden">
              <Link to={verTodos} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--ink)' }}>
                Ver todos <Ic d={I.arrow} s={16} />
              </Link>
            </div>}
          </section>
        );
      })}
    </div>
  );
}
