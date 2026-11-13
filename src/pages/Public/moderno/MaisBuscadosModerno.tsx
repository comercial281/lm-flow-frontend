import { Link } from 'react-router-dom';
import { Ic, type PortalProperty } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { atalhosDoSite, fotoDoAtalho, type Atalho } from '@/features/siteBuilder/public/maisBuscados';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { BLOCO, MIOLO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Mais buscados do Moderno (spec 6.3; protótipo `.bento`, `.tile`,
   `.ms-chips`). Os MESMOS atalhos e destinos do Clássico (`atalhosDoSite`,
   link pra busca com a query do atalho; sem atalho, a seção some). Os
   primeiros 4 atalhos que têm imóvel com foto viram blocos (1 grande, 1
   largo, 2 menores); a foto é a capa do imóvel mais recente que bate
   (`fotoDoAtalho`, com a aba que a busca usaria) e o bloco mostra o rótulo e a contagem. Com menos de 4
   blocos a grade muda pra não sobrar buraco. O resto vira pílula.
──────────────────────────────────────────────────────────────────────────── */

interface Props { home: HomeConfig; items: PortalProperty[]; tenant: string; abas: AbaId[] }

const MAX_BLOCOS = 4;
const SETA_DIAGONAL = 'M7 17L17 7M8 7h9v9';
/** Etiqueta e botão sobre a foto: vidro escuro com texto branco (lê em qualquer foto e em qualquer cor de marca). */
const VIDRO_ESCURO = 'bg-[rgba(8,10,22,0.62)] text-white backdrop-blur-[10px]';

/** Grade do mosaico e lugar de cada bloco, pelo número de blocos. */
const GRADE: Record<number, { grade: string; blocos: string[] }> = {
  1: { grade: 'grid-cols-1 auto-rows-[280px] sm:auto-rows-[340px]', blocos: [''] },
  2: { grade: 'grid-cols-1 auto-rows-[260px] sm:grid-cols-2 sm:auto-rows-[340px]', blocos: ['', ''] },
  3: {
    grade: 'grid-cols-2 grid-rows-[300px_190px] md:grid-cols-[1.1fr_1fr_1fr] md:grid-rows-[250px_250px]',
    blocos: ['col-span-2 md:col-span-1 md:row-span-2', 'md:col-span-2', 'md:col-span-2'],
  },
  4: {
    grade: 'grid-cols-2 grid-rows-[300px_190px_190px] md:grid-cols-[1.1fr_1fr_1fr] md:grid-rows-[250px_250px]',
    blocos: ['col-span-2 md:col-span-1 md:row-span-2', 'col-span-2 md:col-span-2', '', ''],
  },
};

export default function MaisBuscadosModerno({ home, items, tenant, abas }: Props) {
  const ctx = useCtxDoSite(tenant);
  const atalhos = atalhosDoSite(home, items, abas);
  if (atalhos.length === 0) return null;

  const href = (a: Atalho) => caminhoDoSite(ctx, `/imoveis${a.query ? `?${a.query}` : ''}`);
  const blocos: { a: Atalho; url: string; total: number; k: number }[] = [];
  const pilulas: { a: Atalho; k: number }[] = [];
  atalhos.forEach((a, k) => {
    const foto = blocos.length < MAX_BLOCOS ? fotoDoAtalho(a, items, abas) : null;
    if (foto) blocos.push({ a, k, ...foto }); else pilulas.push({ a, k });
  });
  const desenho = GRADE[blocos.length];

  return (
    <section data-mais-buscados className={BLOCO}>
      <div className={MIOLO}>
        <h2 className={`mb-9 ${tituloDeSecao()}`}>Mais buscados</h2>
        {desenho && (
          <div data-mosaico className={`grid gap-3 ${desenho.grade}`}>
            {blocos.map(({ a, url, total, k }, i) => (
              <Link key={`${k}-${a.query}`} to={href(a)} data-bloco
                className={`group relative isolate overflow-hidden rounded-[20px] bg-[var(--m-brand-soft)] ${desenho.blocos[i]}`}>
                <img src={url} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span aria-hidden className={`absolute right-3.5 top-3.5 grid h-[34px] w-[34px] place-items-center rounded-full ${VIDRO_ESCURO}`}>
                  <Ic d={SETA_DIAGONAL} s={14} />
                </span>
                <span className={`absolute bottom-3.5 left-3.5 right-3.5 flex w-fit max-w-[calc(100%-28px)] items-center gap-2 rounded-full px-3.5 py-[7px] text-[13px] font-semibold ${VIDRO_ESCURO}`}>
                  <span className="truncate">{a.label}</span>
                  <small className="text-[12px] font-medium tabular-nums opacity-75">{total}</small>
                </span>
              </Link>
            ))}
          </div>
        )}
        {pilulas.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${desenho ? 'mt-3.5' : ''}`}>
            {pilulas.map(({ a, k }) => (
              <Link key={`${k}-${a.query}`} to={href(a)}
                className="rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--m-head)] transition-colors hover:border-[var(--m-head)]">
                {a.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
