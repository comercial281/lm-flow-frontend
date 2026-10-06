import { Link } from 'react-router-dom';
import { I, Ic, PropertyCard, type PortalProperty, type PortalTab } from '../portalShared';
import type { AbaId, HomeConfig, Vitrine } from '@/features/siteBuilder/public/homeConfig';
import { buscaDaRegra, vitrinesVisiveis } from '@/features/siteBuilder/public/vitrines';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

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

/** Query string do "Ver todos": a busca que traz o mesmo recorte; null = sem o link. */
function buscaDaVitrine(v: Vitrine): string | null {
  if (v.kind === 'launches') return 'tab=launch';
  // Destaques não têm filtro na busca: o botão diz que leva a todos os imóveis.
  if (v.kind === 'featured') return '';
  return v.rules ? buscaDaRegra(v.rules) : null;
}

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
        const q = buscaDaVitrine(vitrine);
        const verTodos = caminhoDoSite(ctx, `/imoveis${q ? `?${q}` : ''}`);
        const tab = abaDaVitrine(vitrine);
        // Regra que não cabe na busca, ou "Ver todos" que cai numa aba escondida,
        // levaria a uma busca que não é a da vitrine: sem o link.
        const abaDoLink = new URLSearchParams(q ?? '').get('tab');
        const temLink = q !== null && abas.includes((abaDoLink ?? 'sale') as AbaId);
        const rotuloLink = vitrine.kind === 'featured' ? 'Ver todos os imóveis' : 'Ver todos';
        return (
          <section key={vitrine.id} className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                {vitrine.kind === 'featured' && (
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selecionados a dedo</span>
                )}
                <h2 className={`${vitrine.kind === 'featured' ? 'mt-1 ' : ''}font-[var(--display)] text-3xl font-semibold sm:text-4xl`}>{vitrine.title}</h2>
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
