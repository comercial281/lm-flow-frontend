import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { I, Ic, type PortalProperty } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { abaDaVitrine, verTodosDaVitrine, vitrinesVisiveis } from '@/features/siteBuilder/public/vitrines';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { TituloComDestaque } from '../TituloComDestaque';
import CartaoFotoInteira from './CartaoFotoInteira';
import { BLOCO, BOTAO_REDONDO, MIOLO, SETA_DIREITA, SETA_ESQUERDA, SOBRETITULO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Vitrines do Moderno (spec 7 "Início"; protótipo `.head-row`, `.rail`): as
   mesmas vitrines, itens e "Ver todos" do Clássico (`vitrinesVisiveis`,
   `verTodosDaVitrine`), em carrossel de cartões de foto inteira; as setas
   rolam um cartão. Cartões grandes (`card_style = large`): duas colunas, sem
   carrossel nem setas.
──────────────────────────────────────────────────────────────────────────── */

interface Props {
  home: HomeConfig; items: PortalProperty[]; tenant: string; abas: AbaId[];
  modo: DestaqueDosTitulos; cartoesGrandes: boolean;
}

/** Rola o carrossel um cartão (largura do primeiro + o espaço entre eles). */
function rolarUmCartao(trilho: HTMLElement | null, sentido: 1 | -1) {
  const cartao = trilho?.firstElementChild as HTMLElement | null;
  if (!trilho || !cartao) return;
  trilho.scrollBy?.({ left: sentido * (cartao.offsetWidth + 14), behavior: 'smooth' });
}

function Vitrine({ titulo, sobretitulo, link, grande, modo, children }: {
  titulo: string; sobretitulo: string | null; link: { href: string; rotulo: string } | null;
  grande: boolean; modo: DestaqueDosTitulos; children: ReactNode[];
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const comSetas = !grande && children.length > 1;
  return (
    <section className={BLOCO}>
      <div className={MIOLO}>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            {sobretitulo && <p className={SOBRETITULO}>{sobretitulo}</p>}
            <h2 className={tituloDeSecao()}><TituloComDestaque texto={titulo} modo={modo} /></h2>
          </div>
          {(link || comSetas) && (
            <div className="flex items-center gap-2">
              {link && (
                <Link to={link.href} className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--m-head)] px-[18px] py-2.5 text-[14px] font-semibold text-[var(--m-head)]">
                  {link.rotulo} <Ic d={I.arrow} s={16} />
                </Link>
              )}
              {comSetas && <>
                <button type="button" aria-label="Anterior" onClick={() => rolarUmCartao(trilho.current, -1)} className={BOTAO_REDONDO}>
                  <Ic d={SETA_ESQUERDA} s={16} />
                </button>
                <button type="button" aria-label="Próximo" onClick={() => rolarUmCartao(trilho.current, 1)} className={BOTAO_REDONDO}>
                  <Ic d={SETA_DIREITA} s={16} />
                </button>
              </>}
            </div>
          )}
        </div>
        <div
          ref={trilho}
          className={grande
            ? 'grid grid-cols-1 gap-3.5 md:grid-cols-2'
            : 'grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col gap-3.5 overflow-x-auto pb-1.5 [scrollbar-width:none] sm:auto-cols-[minmax(270px,300px)] [&::-webkit-scrollbar]:hidden'}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default function VitrinesModernas({ home, items, tenant, abas, modo, cartoesGrandes }: Props) {
  const ctx = useCtxDoSite(tenant);
  const lista = vitrinesVisiveis(home, items);
  if (lista.length === 0) return null;

  return (
    <div id="resultados">
      {lista.map(({ vitrine, itens }) => {
        const tab = abaDaVitrine(vitrine);
        return (
          <Vitrine
            key={vitrine.id} titulo={vitrine.title} modo={modo} grande={cartoesGrandes}
            sobretitulo={vitrine.kind === 'featured' ? 'Selecionados a dedo' : null}
            link={verTodosDaVitrine(vitrine, abas, ctx)}
          >
            {itens.map(p => <CartaoFotoInteira key={p.id} tenant={tenant} p={p} tab={tab} grande={cartoesGrandes} />)}
          </Vitrine>
        );
      })}
    </div>
  );
}
