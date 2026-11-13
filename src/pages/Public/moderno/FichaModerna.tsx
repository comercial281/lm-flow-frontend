import { Link } from 'react-router-dom';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { ESTILO_SELO_DESTAQUE, PortalFooter, PortalHeader } from '../portalShared';
import { linhaDoCondominio } from '../nomeDoCondominio';
import GaleriaEmTelaCheia from '../ficha/GaleriaEmTelaCheia';
import { I, Ic } from '../ficha/iconesDaFicha';
import { derivadosDaFicha, type PropertyDTO, type useFichaDoImovel } from '../ficha/useFichaDoImovel';
import type { FichaDoImovel } from '../ficha/fichaDoImovel';
import GaleriaModerna from './GaleriaModerna';
import CartaoDeInteresse from './CartaoDeInteresse';
import CartaoClaro from './CartaoClaro';
import SecoesDaFichaModerna from './SecoesDaFichaModerna';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Ficha do imóvel do Moderno (spec 7 "Ficha do imóvel" e "Ficha de
   lançamento"; protótipo `#imovel`). Tudo o que a ficha carrega, conta e
   envia é o `useFichaDoImovel` do Clássico; aqui só o desenho:
   "Voltar aos imóveis", galeria em mosaico, tipo · código, título, selos,
   endereço, faixa única de números, custos em pílulas e, à direita, o cartão
   de interesse que acompanha a rolagem (no celular, depois dos custos).
──────────────────────────────────────────────────────────────────────────── */

type Ficha = ReturnType<typeof useFichaDoImovel>;

interface NumeroDaFaixa { n: string; rotulo: string }

const plural = (n: number, um: string, varios: string) => (n > 1 ? varios : um);

/**
 * A faixa única de números do imóvel: só os que existem. Em flex-wrap, a última
 * linha estica pra fechar (em grade, a célula vazia mostrava a cor da linha).
 */
function numerosDaFaixa(p: PropertyDTO): NumeroDaFaixa[] {
  return [
    p.bedrooms ? { n: String(p.bedrooms), rotulo: plural(p.bedrooms, 'dormitório', 'dormitórios') } : null,
    p.suites ? { n: String(p.suites), rotulo: plural(p.suites, 'suíte', 'suítes') } : null,
    p.bathrooms ? { n: String(p.bathrooms), rotulo: plural(p.bathrooms, 'banheiro', 'banheiros') } : null,
    p.parking_spaces ? { n: String(p.parking_spaces), rotulo: plural(p.parking_spaces, 'vaga', 'vagas') } : null,
    p.useful_area_m2 ? { n: `${p.useful_area_m2} m²`, rotulo: 'área útil' } : null,
    p.total_area_m2 ? { n: `${p.total_area_m2} m²`, rotulo: 'área total' } : null,
  ].filter((x): x is NumeroDaFaixa => !!x);
}


export default function FichaModerna({ f, prop, ficha }: { f: Ficha; prop: PropertyDTO; ficha: FichaDoImovel }) {
  const { tenant, ctx, site, manutencao, active, setActive, lightbox, setLightbox, suggestions, fontHrefs, cssVars, fundo, wa, abas, waHref, mostraBook, contato } = f;
  const d = derivadosDaFicha(prop, ficha, site);
  const { photos, typeLabel, price, priceSuffix, money, linhaDoCodigo, atendimento, regionText, selos, fase } = d;
  const lancamento = prop.listing_kind === 'development';
  const numeros = numerosDaFaixa(prop);
  const sobretitulo = [typeLabel, prop.code].filter(Boolean).join(' · ');
  const abrirFoto = (i: number) => { setActive(i); setLightbox(true); };
  // Bloco do book: o cartão de interesse vira o pedido do book; no celular, a página desce até ele.
  const pedirBook = () => {
    contato.setPedindoBook(true);
    const noFluxo = document.getElementById('contato');
    if (noFluxo && noFluxo.offsetParent !== null) noFluxo.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const cartao = {
    contato, mostraBook, waHref, price, priceSuffix, aPartirDe: lancamento && !d.isRent, fase, linhaDoCodigo, money, atendimento,
  };

  return (
    <div data-pagina-moderna="ficha" style={cssVars} data-fundo={fundo} className="min-h-screen bg-[var(--m-ground)] pb-24 text-[var(--m-text)] antialiased lg:pb-0">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}

      <PortalHeader site={site} tenant={tenant!} abas={abas} />

      <main className="px-4">
        <div className={MIOLO}>
          <div className="pb-3.5 pt-[clamp(24px,4vw,44px)]">
            {!manutencao && (
              <Link to={caminhoDoSite(ctx, '/')} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-head)]">
                <Ic d={I.back} s={14} /> Voltar aos imóveis
              </Link>
            )}
          </div>

          <GaleriaModerna fotos={photos} titulo={prop.title} abrir={abrirFoto} videoUrl={prop.video_url} tourUrl={prop.virtual_tour_url} />

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {sobretitulo && <span className="text-[13px] font-semibold text-[var(--m-head)]">{sobretitulo}</span>}
              <h1 className="mt-1.5 font-[var(--display)] text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance]">
                {prop.title}
              </h1>
              {selos.length > 0 && (
                <ul className="mb-2.5 mt-3.5 flex flex-wrap gap-1.5">
                  {selos.map(s => (
                    <li
                      key={s.texto}
                      className={s.destaque
                        ? 'rounded-full px-3 py-1 text-[12.5px] font-semibold'
                        : 'rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-3 py-1 text-[12.5px] font-semibold text-[var(--m-head)]'}
                      style={s.destaque ? ESTILO_SELO_DESTAQUE : undefined}
                    >
                      {s.texto}
                    </li>
                  ))}
                </ul>
              )}
              {regionText && (
                <p className="mt-2 flex items-center gap-1.5 text-[14px] text-[var(--m-muted)]"><Ic d={I.pin} s={15} /> {regionText}</p>
              )}
              {prop.condominium_name && <p className="mt-1 text-[14px] text-[var(--m-muted)]">{linhaDoCondominio(prop.condominium_name)}</p>}

              {numeros.length > 0 && (
                <dl className="mt-[22px] flex flex-wrap gap-px overflow-hidden rounded-[20px] border border-[var(--m-line)] bg-[var(--m-line)]">
                  {numeros.map(n => (
                    <div key={n.rotulo} className="flex min-w-0 flex-1 basis-[120px] flex-col-reverse bg-[var(--m-surface)] px-[18px] py-4">
                      <dt className="text-[12.5px] text-[var(--m-muted)]">{n.rotulo}</dt>
                      <dd className="font-[var(--display)] text-[26px] font-semibold leading-[1.1] text-[var(--m-head)] tabular-nums">{n.n}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {money.length > 0 && (
                <ul aria-label="Custos" className="mt-2.5 flex flex-wrap gap-2">
                  {money.map(m => (
                    <li key={m.label} className="rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-3.5 py-1.5 text-[13px] text-[var(--m-muted)]">
                      {m.label}<b className="ml-1 font-bold text-[var(--m-head)]">{m.value}</b>
                    </li>
                  ))}
                </ul>
              )}

              {/* Celular: o cartão de interesse vem logo depois dos números (é o alvo da barra fixa). */}
              <div className="mt-8 lg:hidden">
                <CartaoDeInteresse {...cartao} id="contato" />
              </div>

              <SecoesDaFichaModerna prop={prop} d={d} mostraBook={mostraBook} pedirBook={pedirBook} />
            </div>

            <aside className="hidden lg:block lg:sticky lg:top-24">
              <CartaoDeInteresse {...cartao} />
            </aside>
          </div>

          {/* Imóveis recomendados (o servidor escolhe; em manutenção a lista dá 404). */}
          {!manutencao && ficha.parecidos && suggestions.length > 0 && (
            <section className="pt-[clamp(56px,8vw,96px)]">
              <h2 className="mb-6 font-[var(--display)] text-[clamp(26px,3.4vw,40px)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)]">
                Você também pode gostar
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map(s => <CartaoClaro key={s.id} tenant={tenant!} p={s} wa={wa} />)}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Celular: a barra fixa de contato continua (é por ela que o lead do anúncio fala). */}
      <div data-testid="barra-de-contato" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[var(--m-line)] bg-[var(--m-surface)] px-4 py-3 shadow-[0_-12px_30px_-20px_rgba(8,10,22,0.35)] lg:hidden">
        {(price || fase) && (
          <div className="min-w-0 flex-1">
            {price && (
              <>
                <div className="text-[11px] text-[var(--m-muted)]">{d.isRent ? 'aluguel' : 'a partir de'}</div>
                <div className="font-[var(--display)] text-[18px] font-semibold leading-none text-[var(--m-head)] tabular-nums">
                  {price}{priceSuffix && <span className="text-[11px] font-medium text-[var(--m-muted)]">{priceSuffix}</span>}
                </div>
              </>
            )}
            {fase && <div className="mt-1 truncate text-[11px] font-semibold text-[var(--m-head)]">{fase}</div>}
          </div>
        )}
        {waHref
          ? <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#1FAF5A] px-5 py-2.5 text-[14px] font-semibold text-white"><Ic d={I.wa} s={17} /> WhatsApp</a>
          : <a href="#contato" className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-[14px] font-semibold text-[var(--brand-ink)]">Tenho interesse</a>}
      </div>

      <PortalFooter site={site} tenant={tenant!} abas={abas} />

      {lightbox && photos.length > 0 && (
        <GaleriaEmTelaCheia photos={photos} active={active} setActive={setActive} titulo={prop.title} fechar={() => setLightbox(false)} />
      )}
    </div>
  );
}
