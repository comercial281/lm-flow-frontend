import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  BotaoWhatsApp, FaixaDePrevia, I, Ic, LinkDoMenuEl, MarcaDoSite, MenuDoCelular, PortalTopBar,
  linkDoWhatsApp, tokensDoSite, useMenuDoCelular, usePublishedArticlesExist, useRolouNaHome,
  type PropsDaMoldura, type RoupaDoMenuDoCelular,
} from '../portalShared';
import PortalTranslate from '../PortalTranslate';
import { itensDoMenu } from '@/features/siteBuilder/public/menuConfig';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { logoNaCapa, logoNaSuperficie, resolverAparencia, type Aparencia, type Superficie } from '@/features/siteBuilder/public/aparenciaConfig';
import { ATRIBUTO_DO_TOPO, useLogoPousado } from '@/features/siteBuilder/public/logoPousado';

/* ────────────────────────────────────────────────────────────────────────────
   Topo do Moderno (spec 7, "Topo"; protótipo `.nav`, `.menu`, `.nav-int`).

   - Início + topo transparente + capa sobre a foto: o topo fica FIXO no alto,
     recuado como o cartão da capa (16px de lado, 12px em cima, até 1120px), e
     flutua por cima do cartão com o menu em pílula de vidro. Ao rolar, vira a
     barra sólida arredondada, ainda fixa. Nunca entra no fluxo: a página não
     salta (o defeito de 17/09 do Clássico). A capa do Moderno é quem deixa o
     espaço dele (`topoSobreACapa`).
   - Fora do Início, com capa dividida ou com topo branco/na cor principal:
     barra sólida arredondada no fluxo, grudada ao rolar (`sticky`).
   - Logo em destaque na capa: no Início o logo do topo espera o da capa pousar
     (#685, o mesmo hook do Clássico); fora do Início ele aparece sempre.
   - Faixa de cima: a do Clássico em linha discreta, FORA do bloco que gruda.
     Não sai quando o topo flutua sobre a capa (ficaria embaixo dele); os
     mesmos contatos estão no menu do celular e no rodapé.

   Cores só pelas variáveis do site (--brand, --brand-ink, --m-*), sem
   color-mix nem opacidade sobre variável (Chrome < 111): transparências em
   rgba literal.
──────────────────────────────────────────────────────────────────────────── */

/**
 * O topo flutua por cima da capa (fixo, fora do fluxo)? Só no Início, com o
 * topo transparente e a capa sobre a foto. A capa do Moderno usa a MESMA regra
 * pra deixar o espaço do topo dentro do cartão.
 */
export function topoSobreACapa(ap: Aparencia, onHome: boolean): boolean {
  return onHome && ap.header_style === 'transparent' && ap.hero_layout !== 'split';
}

interface RoupaModerna {
  /** Fundo, borda e cor do texto da barra (variáveis do site). */
  barra: CSSProperties;
  /** A pílula do menu no computador. */
  pilula: string;
  /** Realce do link no passar do mouse. */
  realce: string;
  superficie: Superficie;
}

const VIDRO = 'border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.14)] backdrop-blur-[14px]';

/** A roupa do topo: vidro sobre a capa, cor principal, branco ou a superfície do site. */
function roupaModerna(ap: Aparencia, flutuando: boolean): RoupaModerna {
  if (flutuando) {
    return {
      barra: { background: 'transparent', borderColor: 'transparent', color: '#FFFFFF' },
      pilula: VIDRO, realce: 'hover:bg-[rgba(255,255,255,0.92)] hover:text-[var(--brand)]', superficie: 'foto',
    };
  }
  if (ap.header_style === 'brand') {
    return {
      barra: { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'var(--brand-ink)' },
      pilula: 'border-transparent', realce: 'hover:bg-[var(--brand-ink)] hover:text-[var(--brand)]', superficie: 'marca',
    };
  }
  if (ap.header_style === 'white') {
    // Branco mesmo no fundo escuro (como no Clássico): cores fixas, a logo normal.
    return {
      barra: { background: '#FFFFFF', borderColor: '#E2E4EB', color: '#17140F' },
      pilula: 'border-transparent', realce: 'hover:bg-[#F2F3F6] hover:text-[var(--brand)]', superficie: 'branco',
    };
  }
  return {
    barra: { background: 'var(--m-surface)', borderColor: 'var(--m-line)', color: 'var(--m-head)' },
    pilula: 'border-transparent', realce: 'hover:bg-[var(--m-brand-soft)] hover:text-[var(--m-head)]', superficie: 'fundo',
  };
}

const MENU_DO_CELULAR: RoupaDoMenuDoCelular = {
  nav: 'rounded-b-[20px] border-t border-[var(--m-line)] bg-[var(--m-surface)] px-[22px] py-3 lg:hidden',
  link: 'block py-2.5 text-[15px] font-medium text-[var(--m-head)]',
  contatos: 'mt-2 border-t border-[var(--m-line)] pt-2 text-[13px] text-[var(--m-muted)]',
};

const juntar = (...cls: (string | false)[]) => cls.filter(Boolean).join(' ');

export default function TopoModerno({ site, tenant, onHome = false, abas }: PropsDaMoldura) {
  const { menuOpen, setMenuOpen, botaoDoMenu } = useMenuDoCelular();
  const rolou = useRolouNaHome(onHome);
  const hasBlog = usePublishedArticlesExist(tenant);
  const ctx = useCtxDoSite(tenant);
  const ap = resolverAparencia(site.appearance);
  const nav = itensDoMenu(site, abas, hasBlog, { ctx, onHome });
  const waHref = linkDoWhatsApp(site.contact?.whatsapp);

  const sobreACapa = topoSobreACapa(ap, onHome);
  // Menu do celular aberto é sempre sólido: texto branco sobre a foto some.
  const flutuando = sobreACapa && !rolou && !menuOpen;
  const roupa = roupaModerna(ap, flutuando);
  const logo = logoNaSuperficie(site.branding?.logo_url, ap, roupa.superficie, tokensDoSite(site).brand);
  // Sobre a capa, sem logo clara, a normal vira branca (como no Clássico).
  const filtroDaLogo = flutuando && !logo.clara ? 'brightness-0 invert' : '';

  // Logo em destaque na capa: só no Início o logo do topo espera o pouso.
  const destaque = logoNaCapa(ap, site.branding?.logo_url);
  const pousado = useLogoPousado(destaque && onHome);
  const logoEsperando = destaque && onHome && !pousado;
  const pousoCls = destaque
    ? juntar('transition-[opacity,transform] duration-300 motion-reduce:transition-none', logoEsperando && 'translate-y-3 opacity-0')
    : '';

  const linkCls = juntar(
    'rounded-full px-3.5 py-[7px] transition-colors', roupa.realce,
    ap.menu_style === 'caps' ? 'text-[11.5px] font-semibold uppercase tracking-[0.09em]' : 'text-[13.5px] font-medium',
  );

  return (
    <>
      {!sobreACapa && <PortalTopBar site={site} ap={ap} moderno />}

      <div
        data-estilo="moderno" data-flutuando={flutuando ? 'sim' : 'nao'}
        className={juntar(sobreACapa ? 'fixed inset-x-0 top-0' : 'sticky top-0', 'pointer-events-none z-40')}
        {...(destaque && onHome ? { [ATRIBUTO_DO_TOPO]: '' } : {})}
      >
        <div className="pointer-events-auto"><FaixaDePrevia site={site} /></div>
        <div className="px-4 pt-3">
          <header
            className={juntar('pointer-events-auto mx-auto max-w-[1120px] rounded-[20px] border transition-colors duration-300', !flutuando && 'shadow-[0_1px_2px_rgba(16,24,40,0.04)]')}
            style={roupa.barra}
          >
            <div className="flex h-[64px] items-center justify-between gap-4 pl-[22px] pr-3 sm:h-[72px]">
              <Link to={caminhoDoSite(ctx, '/')} className="flex min-w-0 items-center gap-2.5"
                {...(logoEsperando ? { 'aria-hidden': true, tabIndex: -1 } : {})}>
                <MarcaDoSite
                  site={site} logo={logo.url}
                  logoCls={juntar('h-10 w-auto max-w-[180px] object-contain sm:h-12 sm:max-w-[240px]', filtroDaLogo, pousoCls)}
                  nomeCls={juntar('font-[var(--display)] text-[14px] font-bold uppercase tracking-[0.14em]', pousoCls)}
                />
              </Link>

              <nav aria-label="Menu principal" className={juntar('hidden items-center gap-1 rounded-full border p-[5px] lg:flex', roupa.pilula)}>
                {nav.map(l => <LinkDoMenuEl key={l.chave} l={l} cls={linkCls} />)}
              </nav>

              <div className="flex items-center gap-2">
                {site.translate?.enabled && <PortalTranslate languages={site.translate.languages ?? []} />}
                {waHref && <BotaoWhatsApp href={waHref} />}
                <button
                  ref={botaoDoMenu}
                  type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls="menu-do-celular"
                  onClick={() => setMenuOpen(o => !o)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current opacity-80 lg:hidden"
                >
                  <Ic d={menuOpen ? I.close : I.menu} s={18} />
                </button>
              </div>
            </div>

            {menuOpen && <MenuDoCelular site={site} nav={nav} fechar={() => setMenuOpen(false)} roupa={MENU_DO_CELULAR} />}
          </header>
        </div>
      </div>
    </>
  );
}
