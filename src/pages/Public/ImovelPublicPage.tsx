import { useLayoutEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';
import { BrPhoneInput } from '@/components/shared';
import {
  typologyHeadline,
  typologyName,
  typologyPrice,
  typologySpecs,
} from '@/features/properties/typologies';
import { PortalFooter, PortalHeader, PropertyCard } from './portalShared';
import FinalidadeChoice from './FinalidadeChoice';
import { linhaDoCondominio } from './nomeDoCondominio';
import SelosDoImovel from './ficha/SelosDoImovel';
import MidiaDoImovel from './ficha/MidiaDoImovel';
import DadosDoEmpreendimento from './ficha/DadosDoEmpreendimento';
import GaleriaEmTelaCheia from './ficha/GaleriaEmTelaCheia';
import TextoComNegrito from './ficha/TextoComNegrito';
import { I, Ic } from './ficha/iconesDaFicha';
import { derivadosDaFicha, useFichaDoImovel } from './ficha/useFichaDoImovel';
import { resolverAparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import FichaModerna from './moderno/FichaModerna';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — PÁGINA DO IMÓVEL (Produto A). Mesma pegada "Editorial
   Estate" da home: moderna, indexável (SEO), focada em converter o lead via
   WhatsApp + formulário. Brandável pelo registro do Site (logo/cor/WhatsApp).
   A lógica (carga, SEO, visita, galeria, parecidos e contato) mora em
   `useFichaDoImovel`; aqui só o desenho Clássico.
──────────────────────────────────────────────────────────────────────────── */

/**
 * Trocar de imóvel sem sair da ficha (clique em "Você também pode gostar", ou
 * voltar do navegador entre duas fichas) mantinha a mesma tela montada: a página
 * ficava parada lá embaixo, parecendo que o clique não fez nada, e o formulário,
 * a foto aberta e o "contato enviado" passavam pro imóvel seguinte. A ficha
 * agora recomeça do zero (key = código) e no topo a cada imóvel.
 */
export default function ImovelPublicPage() {
  const { code } = useParams<{ code: string }>();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [code]);
  return <FichaDoImovel key={code} />;
}


function FichaDoImovel() {
  const f = useFichaDoImovel();
  const {
    tenant, ctx, state, site, prop, ficha, manutencao, active, setActive, lightbox, setLightbox, suggestions,
    fontHrefs, cssVars, fundo, wa, abas, waHref, mostraBook, contato,
  } = f;
  const {
    name, setName, phone, setPhone, phoneErr, setPhoneErr, sent, enviando, falhouEnvio, enviadoNaPrevia,
    pedindoBook, setPedindoBook, finalidade, setFinalidade, submitLead, escolheFinalidade,
  } = contato;

  if (state === 'loading') return <div data-carregando className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  if (state === 'notfound' || !prop || !ficha) return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Imóvel não encontrado.</div>;
  // Moderno: outro desenho, com a mesma carga, visita e contato.
  if (resolverAparencia(site.appearance).style === 'modern') return <FichaModerna f={f} prop={prop} ficha={ficha} />;

  const {
    photos, typeLabel, isRent, price, priceSuffix, money, linhaDoCodigo, atendimento,
    featureLabels, condoLabels, typologies, regionText, mapa, selos, fase, dadosDoPredioList, construtora, specs,
  } = derivadosDaFicha(prop, ficha, site);
  const cover = photos[active] || photos[0];

  const ContactForm = (
    sent && enviadoNaPrevia ? (
      <div role="status" className="rounded-2xl bg-amber-400 p-6 text-center font-semibold text-neutral-900">
        {TEXTO_ENVIO_NA_PREVIA}
      </div>
    ) : sent ? (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/[0.06]">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        {pedindoBook ? (
          <p className="font-semibold text-[var(--ink)]">Pronto! O book vai chegar no seu WhatsApp em alguns minutos.</p>
        ) : (
          <>
            <p className="font-semibold text-[var(--ink)]">Recebemos seu interesse!</p>
            <p className="mt-1 text-sm text-neutral-500">Um especialista vai te chamar em breve.</p>
          </>
        )}
      </div>
    ) : (
      <form onSubmit={submitLead} className="space-y-3">
        {pedindoBook && <p className="text-[15px] font-semibold text-[var(--ink)]">Receba o book no WhatsApp</p>}
        {escolheFinalidade && <FinalidadeChoice value={finalidade} onChange={setFinalidade} />}
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" className="w-full rounded-xl border border-black/10 px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]" />
        <BrPhoneInput
          value={phone}
          onChange={v => { setPhone(v); if (phoneErr) setPhoneErr(false); }}
          required
          placeholder="Seu WhatsApp"
          aria-invalid={phoneErr}
          className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] ${phoneErr ? 'border-red-400' : 'border-black/10'}`}
        />
        {phoneErr && <p className="-mt-1 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>}
        {falhouEnvio && <p role="alert" className="text-[13px] text-red-500">{falhouEnvio}</p>}
        <button type="submit" disabled={enviando} className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--brand)' }}>{pedindoBook ? 'Receber o book' : 'Tenho interesse'}</button>
        {pedindoBook && <button type="button" onClick={() => setPedindoBook(false)} className="w-full text-center text-[13px] text-neutral-500 underline">Voltar</button>}
        {mostraBook && !pedindoBook && (
          <button type="button" onClick={() => setPedindoBook(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 text-[15px] font-semibold" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}><Ic d={I.wa} s={18} /> Receber o book no WhatsApp</button>
        )}
        {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={18} /> Chamar no WhatsApp</a>}
      </form>
    )
  );

  return (
    <div style={cssVars} data-fundo={fundo} className="min-h-screen bg-[var(--paper)] pb-24 text-[var(--ink)] antialiased lg:pb-0">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}

      {/* Cabeçalho COMPARTILHADO com o resto do portal. Esta página é onde o
          anúncio pago joga o visitante, e ela era a única sem menu nenhum: quem
          chegava por anúncio não tinha como alcançar o resto do site. Dois
          cabeçalhos também garantiam que toda melhoria alcançasse quatro
          páginas e esquecesse a quinta — justamente a que recebe a verba. */}
      <PortalHeader site={site} tenant={tenant!} abas={abas} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {!manutencao && (
          <Link to={caminhoDoSite(ctx, '/')} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-[var(--brand)]">
            <Ic d={I.back} s={16} /> Voltar aos imóveis
          </Link>
        )}

        {/* Galeria */}
        {cover && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="group relative overflow-hidden rounded-[20px] bg-neutral-100">
              <button
                type="button"
                aria-label="Ampliar foto"
                onClick={() => setLightbox(true)}
                className="block w-full cursor-zoom-in"
              >
                <img src={cover.file_url} alt={cover.alt_text || prop.title} fetchPriority="high" className="h-[280px] w-full object-cover sm:h-[440px]" />
              </button>
              <span className="pointer-events-none absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 toque:opacity-100">
                <Ic d={I.expand} s={16} />
              </span>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={e => { e.stopPropagation(); setActive(a => (a - 1 + photos.length) % photos.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[var(--ink)] shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-white"
                  >
                    <Ic d={I.back} s={20} />
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima foto"
                    onClick={e => { e.stopPropagation(); setActive(a => (a + 1) % photos.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[var(--ink)] shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-white"
                  >
                    <Ic d={I.next} s={20} />
                  </button>
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
                    {active + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto sm:max-h-[440px] sm:w-24 sm:flex-col sm:overflow-y-auto">
                {photos.map((ph, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-full ${i === active ? 'ring-2 ring-[var(--brand)]' : 'ring-1 ring-black/[0.06] opacity-80'}`}>
                    <img src={ph.thumbnail_url || ph.file_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <MidiaDoImovel videoUrl={prop.video_url} tourUrl={prop.virtual_tour_url} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Conteúdo */}
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{typeLabel}</span>
            <h1 className="mt-1.5 font-[var(--display)] text-3xl font-semibold leading-tight sm:text-4xl">{prop.title}</h1>
            <SelosDoImovel selos={selos} />
            {regionText && <p className="mt-2 flex items-center gap-1.5 text-[15px] text-neutral-500"><Ic d={I.pin} s={16} /> {regionText}</p>}
            {prop.condominium_name && <p className="mt-1 text-[15px] text-neutral-500">{linhaDoCondominio(prop.condominium_name)}</p>}

            {specs.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s, i) => (
                  <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
                    <span className="text-[var(--brand)]"><Ic d={s.d} s={20} /></span>
                    <div className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {money.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white px-5 py-4 ring-1 ring-black/[0.06]">
                {money.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[var(--brand)]"><Ic d={I.coin} s={17} /></span>
                    <span className="text-[13px] text-neutral-500">{m.label}</span>
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{m.value}</span>
                  </div>
                ))}
              </div>
            )}

            {prop.description && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Sobre o imóvel</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700"><TextoComNegrito texto={prop.description} classeDoNegrito="font-semibold text-[var(--ink)]" /></p>
              </section>
            )}

            {/* Tipologias: a tabela de plantas do empreendimento. Sem ela, um
                lançamento com 3 plantas aparecia como se tivesse uma unidade só
                (a do resumo) e o lead perguntava no WhatsApp o que já estava no book. */}
            {typologies.length > 0 && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Tipologias disponíveis</h2>
                {typologyHeadline(typologies) && (
                  <p className="mt-1 text-[14px] text-neutral-500">{typologyHeadline(typologies)}</p>
                )}
                <div className="mt-3 overflow-x-auto">
                  <ul className="min-w-full space-y-2">
                    {typologies.map((t, i) => {
                      const price = typologyPrice(t);
                      return (
                        <li
                          key={i}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-white px-5 py-4 ring-1 ring-black/[0.06]"
                        >
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-[var(--ink)]">{typologyName(t, i)}</p>
                            <p className="mt-0.5 text-[13px] text-neutral-500">{typologySpecs(t).join(' · ')}</p>
                            {t.notes && <p className="mt-0.5 text-[13px] text-neutral-500">{t.notes}</p>}
                          </div>
                          {price && (
                            <span className="whitespace-nowrap text-[15px] font-semibold text-[var(--brand)]">{price}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            )}

            {featureLabels.length > 0 && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Características</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                  {featureLabels.map((label, i) => (
                    <li key={i} className="flex items-center gap-2 text-[15px] text-neutral-700">
                      <span className="text-[var(--brand)]"><Ic d={I.check} s={17} /></span>
                      {label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <DadosDoEmpreendimento dados={dadosDoPredioList} construtora={construtora} />

            {condoLabels.length > 0 && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Comodidades do condomínio</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                  {condoLabels.map((label, i) => (
                    <li key={i} className="flex items-center gap-2 text-[15px] text-neutral-700">
                      <span className="text-[var(--brand)]"><Ic d={I.check} s={17} /></span>
                      {label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {mapa && (
              <section className="mt-9">
                <h2 className="font-[var(--display)] text-2xl font-semibold">Localização</h2>
                <p className="mt-1 text-[14px] text-neutral-500">{regionText}</p>
                {/* Revenda: mapa aproximado da região, sem pino. Empreendimento:
                    alfinete no ponto exato (lat/lng do servidor). */}
                <div className="mt-3 overflow-hidden rounded-[20px] ring-1 ring-black/[0.06]">
                  <iframe title={mapa.exato ? 'Mapa do empreendimento' : 'Mapa da região'} width="100%" height="300" loading="lazy" style={{ border: 0 }}
                    src={`https://www.google.com/maps?q=${mapa.q}&z=${mapa.exato ? 16 : 14}&output=embed`} />
                </div>
              </section>
            )}
          </div>

          {/* Card de contato (sticky no desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[22px] bg-white p-6 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06]">
              {price && (
                <div className="font-[var(--display)] text-3xl font-semibold text-[var(--ink)]">
                  {price}{priceSuffix && <span className="text-base font-medium text-neutral-400">{priceSuffix}</span>}
                </div>
              )}
              {fase && <div className="mt-1.5 text-[14px] font-medium text-[var(--brand)]">{fase}</div>}
              <div className="mt-1 text-[13px] text-neutral-500">{linhaDoCodigo}</div>
              {money.length > 0 && (
                <div className="mt-3 space-y-1">
                  {money.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">{m.label}</span>
                      <span className="font-medium text-[var(--ink)]">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="my-4 border-t border-black/[0.06]" />
              <p className="mb-3 text-[14px] font-medium text-neutral-600">Fale com um especialista sobre este imóvel</p>
              {ContactForm}
              {atendimento && <p className="mt-4 text-center text-[12px] text-neutral-400">{atendimento}</p>}
            </div>
          </aside>
        </div>

        {/* Form no fluxo (mobile) */}
        <section id="contato" className="mt-10 rounded-[22px] bg-white p-6 ring-1 ring-black/[0.06] lg:hidden">
          {price && (
            <div className="font-[var(--display)] text-2xl font-semibold">
              {price}{priceSuffix && <span className="text-sm font-medium text-neutral-400">{priceSuffix}</span>}
            </div>
          )}
          {fase && <div className="mt-1 text-[14px] font-medium text-[var(--brand)]">{fase}</div>}
          {money.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-500">
              {money.map((m, i) => <span key={i}>{m.label} <span className="font-medium text-[var(--ink)]">{m.value}</span></span>)}
            </div>
          )}
          <div className="mt-1 text-[12px] text-neutral-500">{linhaDoCodigo}</div>
          <p className="mb-3 mt-2 text-[14px] text-neutral-500">Fale com um especialista sobre este imóvel</p>
          {ContactForm}
          {atendimento && <p className="mt-4 text-center text-[12px] text-neutral-400">{atendimento}</p>}
        </section>

        {/* Imóveis recomendados */}
        {!manutencao && ficha.parecidos && suggestions.length > 0 && (
          <section className="mt-14">
            <h2 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">Você também pode gostar</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map(s => <PropertyCard key={s.id} tenant={tenant!} p={s} wa={wa} />)}
            </div>
          </section>
        )}
      </main>

      {/* Barra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {(price || fase) && (
          <div className="min-w-0 flex-1">
            {price && <><div className="text-[11px] text-neutral-400">{isRent ? 'aluguel' : 'a partir de'}</div><div className="font-[var(--display)] text-lg font-semibold leading-none">{price}{priceSuffix && <span className="text-[11px] font-medium text-neutral-400">{priceSuffix}</span>}</div></>}
            {fase && <div className="mt-1 truncate text-[11px] font-medium text-[var(--brand)]">{fase}</div>}
          </div>
        )}
        {waHref
          ? <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={17} /> WhatsApp</a>
          : <a href="#contato" className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--brand)' }}>Tenho interesse</a>}
      </div>

      <PortalFooter site={site} tenant={tenant!} abas={abas} />


      {/* Lightbox — foto em tela cheia */}
      {lightbox && cover && (
        <GaleriaEmTelaCheia photos={photos} active={active} setActive={setActive} titulo={prop.title} fechar={() => setLightbox(false)} />
      )}
    </div>
  );
}
