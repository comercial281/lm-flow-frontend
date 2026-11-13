import { useEffect, useState } from 'react';
import type { PortalProperty, SiteInfo } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { filtroDaCapaModerna, logoNaCapa, logoNaSuperficie, resolverAparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import { ATRIBUTO_DO_LOGO_DA_CAPA, useLogoPousado } from '@/features/siteBuilder/public/logoPousado';
import { TituloComDestaque } from '../TituloComDestaque';
import { fotoDaCapa, textosDaCapa, useBuscaDaCapa } from '../home/useBuscaDaCapa';
import BuscaModerna from './BuscaModerna';
import { topoSobreACapa } from './TopoModerno';
import { DESTAQUE_SOBRE_A_FOTO, DESTAQUE_SOBRE_O_CLARO } from './destaqueModerno';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Capa do Moderno (spec 6.4 e 7; protótipo `.hero`, `.hero-photo`, `.hero-row`).

   - Sobre a foto: a foto de ponta a ponta (sem recuo, sem cantos), com a
     altura da tela em "Tela cheia" e 580px em "Metade" (decisão do Tony,
     13/11: substitui o cartão recuado). O filtro (`hero_overlay`) escurece de
     baixo pra cima e da esquerda e termina ESCURO no pé da foto, nunca
     desbota pro fundo do site. Título, subtítulo, logo e busca seguem a
     coluna da página (16px de lado, até 1120px), com a busca no pé da foto.
     Quando o topo flutua por cima (`topoSobreACapa`), a capa deixa o espaço
     dele em cima.
   - Logo em destaque (`logoNaCapa`): com os tamanhos do Clássico (126px no
     computador, 80/96px no celular). No computador à direita do título,
     centrado no bloco título + subtítulo e na mesma borda direita da busca;
     no celular em cima do título. Pousa no topo ao rolar (#685).
   - Dividida: texto e busca à esquerda, a foto num cartão à direita (no
     celular, depois do texto, com 240px). Sem filtro: o texto não fica sobre
     a foto.
──────────────────────────────────────────────────────────────────────────── */

interface Props {
  site: SiteInfo; home: HomeConfig; items: PortalProperty[]; tenant: string; abas: AbaId[];
  cities: string[]; hoods: string[]; types: string[];
  /** Avisado quando a pessoa troca de aba (a captura de contato acompanha). */
  onTab?: (tab: AbaId) => void;
}

const TITULO = 'font-[var(--display)] text-[clamp(38px,5vw,68px)] font-semibold leading-[1.02] tracking-[-0.03em] max-w-[13ch] [text-wrap:balance]';

/** O espaço que a capa deixa em cima quando o topo flutua: 12px + 72px do topo e 12px de folga. */
const ESPACO_DO_TOPO = 96;

/**
 * Altura do topo que flutua por cima da capa, medida na tela: com a faixa da
 * prévia (que mora no mesmo bloco fixo e quebra em 2 ou 3 linhas no celular)
 * ele fica mais alto, e o título não pode ficar embaixo dele. Sem medida
 * (antes de montar, ou sem o topo): os 96px de sempre.
 */
function useEspacoDoTopo(ativo: boolean): number {
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const topo = document.querySelector<HTMLElement>('[data-estilo="moderno"]');
    if (!topo) return;
    const medir = () => setAltura(topo.offsetHeight);
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(topo);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, [ativo]);
  return Math.max(ESPACO_DO_TOPO, altura + 12);
}

function Midia({ site, items }: { site: SiteInfo; items: PortalProperty[] }) {
  if (site.hero?.video_url) {
    return <video src={site.hero.video_url} autoPlay muted loop playsInline preload="auto" className="h-full w-full object-cover" />;
  }
  return <img src={fotoDaCapa(site, items)} alt="" fetchPriority="high" className="h-full w-full object-cover" />;
}

export default function CapaModerna({ site, home, items, tenant, abas, cities, hoods, types, onTab }: Props) {
  const busca = useBuscaDaCapa({ home, tenant, abas, cities, hoods, types, items, onTab });
  const { titulo, subtitulo } = textosDaCapa(site, home);
  const ap = resolverAparencia(site.appearance);
  const telaCheia = ap.hero_height === 'full';

  const sobOTopo = topoSobreACapa(ap, true);
  const espacoDoTopo = useEspacoDoTopo(sobOTopo);

  const destaque = logoNaCapa(ap, site.branding?.logo_url);
  const pousado = useLogoPousado(destaque);

  if (ap.hero_layout === 'split') {
    return (
      <section id="topo" className="px-4 pt-3">
        <div className={`${MIOLO} grid gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] ${telaCheia ? 'md:min-h-[calc(100svh-120px)]' : ''}`}>
          <div className="flex min-w-0 flex-col justify-center py-8 md:pr-[clamp(8px,3vw,40px)]">
            <h1 className={`${TITULO} text-[var(--m-head)] ${DESTAQUE_SOBRE_O_CLARO}`}>
              <TituloComDestaque texto={titulo} modo={ap.heading_highlight} />
            </h1>
            <p className="mb-6 mt-[18px] max-w-[46ch] text-[16px] leading-relaxed text-[var(--m-text)]">{subtitulo}</p>
            <BuscaModerna busca={busca} abas={abas} dividida />
          </div>
          <div className="relative h-[240px] overflow-hidden rounded-[28px] bg-[var(--m-brand-soft)] md:h-auto md:min-h-[440px]">
            <div className="absolute inset-0"><Midia site={site} items={items} /></div>
          </div>
        </div>
      </section>
    );
  }

  // Sobre a foto: a logo clara, ou a normal em branco (a regra do topo sobre a capa).
  const logo = destaque ? logoNaSuperficie(site.branding?.logo_url, ap, 'foto') : null;
  const logoCls = logo
    ? `object-contain transition-opacity duration-300 motion-reduce:transition-none${logo.clara ? '' : ' brightness-0 invert'}${pousado ? ' opacity-0' : ''}`
    : '';
  const logoEl = (cls: string) => logo?.url
    ? <img {...{ [ATRIBUTO_DO_LOGO_DA_CAPA]: '' }} src={logo.url} alt={site.name || 'Portal'} className={`${cls} ${logoCls}`} />
    : null;

  return (
    <section
      id="topo" data-capa-moderna data-capa-de-ponta-a-ponta
      className={`relative isolate flex overflow-hidden bg-[#080A16] text-white ${telaCheia ? 'min-h-[max(580px,100svh)]' : 'min-h-[580px]'}`}
    >
      <div className="absolute inset-0 -z-10">
        <Midia site={site} items={items} />
        <div className="absolute inset-0" style={{ background: filtroDaCapaModerna(ap.hero_overlay) }} />
      </div>

      {/* O conteúdo segue a coluna do resto da página (16px de lado, até 1120px).
          O topo flutua por cima da foto (fixo, 12px + 72px, mais a faixa da prévia): o espaço dele fica aqui. */}
      <div
        className={`${MIOLO} flex w-full min-w-0 flex-col justify-end px-4 ${sobOTopo ? 'pt-[96px]' : 'pt-12'}`}
        style={sobOTopo && espacoDoTopo > ESPACO_DO_TOPO ? { paddingTop: espacoDoTopo } : undefined}
      >
        {/* Título e subtítulo à esquerda; no computador o logo à direita, centrado
            no bloco do texto e encostado na borda direita da coluna (a mesma da
            busca). Tamanhos do logo da capa do Clássico. */}
        <div data-capa-texto className="grid items-center gap-8 pb-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            {logoEl('mb-6 h-20 w-auto max-w-[75%] object-left sm:h-24 lg:hidden')}
            <h1 className={`${TITULO} text-white ${DESTAQUE_SOBRE_A_FOTO}`}>
              <TituloComDestaque texto={titulo} modo={ap.heading_highlight} sobreEscuro />
            </h1>
            <p className="mt-[18px] max-w-[46ch] text-[16px] leading-relaxed text-[rgba(255,255,255,0.86)]">{subtitulo}</p>
          </div>
          {logoEl('hidden h-[126px] w-auto max-w-[420px] shrink-0 self-center object-right lg:block')}
        </div>
        <BuscaModerna busca={busca} abas={abas} />
      </div>
    </section>
  );
}
