import { Link } from 'react-router-dom';
import {
  CreditoDoRodape, I, Ic, LinkDoMenuEl, MarcaDoSite, linkDoWhatsApp, linksDoRodapeDeAntes, linksDoRodapeDoMenu,
  ICONE_DA_REDE, onlyDigits, socialEntries, tokensDoSite, usePublishedArticlesExist, type PropsDaMoldura,
} from '../portalShared';
import { TituloComDestaque } from '../TituloComDestaque';
import { DESTAQUE_SOBRE_A_COR } from './destaqueModerno';
import { itensDoMenu, menuPersonalizado } from '@/features/siteBuilder/public/menuConfig';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { logoNaSuperficie, resolverAparencia, textoSobre, TEXTO_RODAPE_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';

/* ────────────────────────────────────────────────────────────────────────────
   Rodapé do Moderno (spec 7, "Rodapé"; protótipo `footer`, `.f-grid`, `.say`).
   Bloco arredondado na cor principal, com a logo em marca d'água. Colunas ou
   uma linha (`footer_layout`). Os links são os mesmos do Clássico. Cores só
   pelas variáveis do site; branco translúcido em rgba literal.
──────────────────────────────────────────────────────────────────────────── */

const LINK = 'text-[14px] text-[rgba(255,255,255,0.7)] transition-colors hover:text-white';
const TITULO_COL = 'mb-3.5 mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]';

function Coluna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className={TITULO_COL}>{titulo}</h4>
      <ul className="grid gap-2 text-[14px]">{children}</ul>
    </div>
  );
}

export default function RodapeModerno({ site, tenant, onHome = false, abas }: PropsDaMoldura) {
  const hasBlog = usePublishedArticlesExist(tenant);
  const ctx = useCtxDoSite(tenant);
  const ap = resolverAparencia(site.appearance);
  const brand = tokensDoSite(site).brand;
  const logo = logoNaSuperficie(site.branding?.logo_url, ap, 'marca', brand);
  const frase = ap.footer_text ?? TEXTO_RODAPE_FABRICA;
  const waHref = linkDoWhatsApp(site.contact?.whatsapp);
  const redes = socialEntries(site);
  const compacto = ap.footer_layout === 'compact';
  const personalizado = menuPersonalizado(site);
  const { imoveis, institucional, todos } = personalizado
    ? linksDoRodapeDoMenu(itensDoMenu(site, abas, hasBlog, { ctx, onHome }))
    : linksDoRodapeDeAntes(site, abas, hasBlog, ctx, onHome);
  // Logo normal vira branca só sobre cor principal escura.
  const filtroDaLogo = logo.clara || textoSobre(brand) !== '#FFFFFF' ? '' : 'brightness-0 invert';

  const marca = (
    <Link to={caminhoDoSite(ctx, '/')} className="inline-block">
      <MarcaDoSite
        site={site} logo={logo.url}
        logoCls={`h-10 w-auto max-w-[180px] object-contain ${filtroDaLogo}`}
        nomeCls="font-[var(--display)] text-[18px] font-bold text-white"
      />
    </Link>
  );
  const fraseEl = (
    <p className={`font-[var(--display)] font-semibold text-white ${DESTAQUE_SOBRE_A_COR} ${ap.footer_text ? 'whitespace-pre-line' : ''} ${compacto ? 'text-[18px] leading-tight' : 'my-[18px] max-w-[15ch] text-[22px] leading-[1.2] tracking-[-0.02em]'}`}>
      <TituloComDestaque texto={frase} modo={ap.heading_highlight} sobreEscuro />
    </p>
  );
  const redesEl = (redes.length > 0 || (compacto && waHref)) && (
    <div className="flex flex-wrap gap-2">
      {redes.map(sn => (
        <a key={sn.key} href={sn.url} target="_blank" rel="noreferrer" aria-label={sn.label} title={sn.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.28)] text-white transition-colors hover:bg-[rgba(255,255,255,0.14)]">
          <Ic d={ICONE_DA_REDE[sn.key] ?? I.link} s={15} />
        </a>
      ))}
      {compacto && waHref && (
        <a href={waHref} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"
          className="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}>
          <Ic d={I.wa} s={15} /> WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <footer
      data-estilo="moderno" data-rodape={compacto ? 'compact' : 'columns'}
      className="relative isolate mx-auto my-4 w-[calc(100%-32px)] max-w-[1120px] overflow-hidden rounded-[28px] px-[22px] pb-6 pt-8 text-[rgba(255,255,255,0.7)] sm:px-[clamp(22px,5vw,64px)] sm:pt-14"
      style={{ background: 'var(--brand)' }}
    >
      {logo.url && (
        <img src={logo.url} alt="" aria-hidden="true"
          className={`pointer-events-none absolute -top-[10%] right-[4%] -z-10 h-[380px] w-[380px] object-contain opacity-[0.06] ${filtroDaLogo}`} />
      )}

      {compacto ? (
        <div className="flex flex-wrap items-center justify-between gap-5">
          {marca}
          <nav aria-label="Links do rodapé" className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
            {todos.map(l => <LinkDoMenuEl key={l.chave} l={l} cls={LINK} />)}
          </nav>
          {redesEl}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="col-span-2 lg:col-span-1">
            {marca}
            {fraseEl}
            {redesEl}
          </div>
          {(imoveis.length > 0 || institucional.length > 0) && (
            <nav aria-label="Links do rodapé" className="contents">
              {imoveis.length > 0 && (
                <Coluna titulo="Imóveis">
                  {imoveis.map(l => <li key={l.chave}><LinkDoMenuEl l={l} cls={LINK} /></li>)}
                </Coluna>
              )}
              {(institucional.length > 0 || !personalizado) && (
                <Coluna titulo="Institucional">
                  {institucional.map(l => <li key={l.chave}><LinkDoMenuEl l={l} cls={LINK} /></li>)}
                </Coluna>
              )}
            </nav>
          )}
          <Coluna titulo="Atendimento">
            {site.contact?.address && <li className="whitespace-pre-line">{site.contact.address}</li>}
            {waHref && (
              <li>
                <a href={waHref} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}>
                  <Ic d={I.wa} s={15} /> WhatsApp
                </a>
              </li>
            )}
            {site.contact?.phone && <li><a href={`tel:${onlyDigits(site.contact.phone)}`} className={LINK}>{site.contact.phone}</a></li>}
            {site.contact?.email && <li><a href={`mailto:${site.contact.email}`} className={`${LINK} break-all`}>{site.contact.email}</a></li>}
          </Coluna>
        </div>
      )}

      {compacto && <div className="mt-5">{fraseEl}</div>}
      <div className={`flex flex-wrap justify-between gap-4 border-t border-[rgba(255,255,255,0.14)] pt-[18px] text-[12px] ${compacto ? 'mt-4' : 'mt-11'}`}>
        <span><CreditoDoRodape nome={site.name} creci={site.creci} /></span>
      </div>
    </footer>
  );
}
