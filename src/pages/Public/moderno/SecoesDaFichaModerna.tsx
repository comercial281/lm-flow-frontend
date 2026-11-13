import type { ReactNode } from 'react';
import { embedDoTour, embedDoVideo } from '@/features/siteBuilder/public/midiaDoImovel';
import { paragrafosDaDescricao } from '@/features/siteBuilder/public/negritoNaDescricao';
import { typologyHeadline, typologyName, typologyPrice, type PropertyTypology } from '@/features/properties/typologies';
import MidiaDoImovel from '../ficha/MidiaDoImovel';
import TextoComNegrito from '../ficha/TextoComNegrito';
import { I, Ic } from '../ficha/iconesDaFicha';
import type { DerivadosDaFicha, PropertyDTO } from '../ficha/useFichaDoImovel';
import { ID_DA_MIDIA } from './GaleriaModerna';

/* ────────────────────────────────────────────────────────────────────────────
   Seções de conteúdo da ficha do Moderno (protótipo `.f-sec`, `.emp-grid`,
   `.tbl`, `.checks`, `.book`). Cada uma some inteira quando a ficha (ou a
   "Página do imóvel" do Personalizar, já aplicada em `derivadosDaFicha`) não
   tem o dado: nunca título solto. Ordem do protótipo: Dados do
   empreendimento, Tipologias, Sobre, Características, Comodidades, Vídeo e
   tour, Localização e o bloco do book.
──────────────────────────────────────────────────────────────────────────── */

const TITULO = 'mb-3.5 font-[var(--display)] text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.02em] text-[var(--m-head)]';

function Secao({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[140px] pt-11">
      <h2 className={TITULO}>{titulo}</h2>
      {children}
    </section>
  );
}

function ListaComCheck({ itens }: { itens: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(t => (
        <li key={t} className="flex items-center gap-2 text-[14px] text-[var(--m-text)]">
          <span className="shrink-0 text-[var(--m-head)]"><Ic d={I.check} s={16} /></span>{t}
        </li>
      ))}
    </ul>
  );
}

const area = (t: PropertyTypology) => {
  const m = t.useful_area_m2 || t.total_area_m2;
  return m ? `${m.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m²` : null;
};
const dormitorios = (t: PropertyTypology) => {
  const partes = [t.bedrooms ? `${t.bedrooms} dorm.` : null, t.suites ? `${t.suites} suíte${t.suites > 1 ? 's' : ''}` : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
};
const vagas = (t: PropertyTypology) => (t.parking_spaces ? String(t.parking_spaces) : null);

/** Colunas da tabela de tipologias: só as que alguma planta preenche. */
const COLUNAS: { rotulo: string; valor: (t: PropertyTypology) => string | null }[] = [
  { rotulo: 'Área', valor: area },
  { rotulo: 'Dormitórios', valor: dormitorios },
  { rotulo: 'Vagas', valor: vagas },
  { rotulo: 'A partir de', valor: typologyPrice },
];

function Tipologias({ lista }: { lista: PropertyTypology[] }) {
  const colunas = COLUNAS.filter(c => lista.some(t => c.valor(t)));
  const resumo = typologyHeadline(lista);
  return (
    <Secao titulo="Tipologias disponíveis">
      {resumo && <p className="-mt-2 mb-3 text-[14px] text-[var(--m-muted)]">{resumo}</p>}
      {/* A tabela rola sozinha no celular: a página nunca rola de lado. */}
      <div className="overflow-x-auto rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)]">
        <table className="w-full min-w-[520px] border-collapse text-[14px]">
          <thead>
            <tr>
              <th className="border-b border-[var(--m-line)] px-4 py-3 text-left text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--m-muted)]">Planta</th>
              {colunas.map(c => (
                <th key={c.rotulo} className="border-b border-[var(--m-line)] px-4 py-3 text-left text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--m-muted)]">{c.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((t, i) => (
              <tr key={i} className="[&:not(:last-child)>td]:border-b [&>td]:border-[var(--m-line)]">
                <td className="px-4 py-3.5 align-top">
                  <b className="font-semibold text-[var(--m-head)]">{typologyName(t, i)}</b>
                  {t.notes && <span className="mt-0.5 block text-[12.5px] text-[var(--m-muted)]">{t.notes}</span>}
                </td>
                {colunas.map((c, j) => {
                  const v = c.valor(t);
                  const ultima = j === colunas.length - 1 && c.rotulo === 'A partir de';
                  return (
                    <td key={c.rotulo} className={`px-4 py-3.5 align-top tabular-nums text-[var(--m-text)] ${c.rotulo === "Dormitórios" ? "" : "whitespace-nowrap"}`}>
                      {v ? (ultima ? <b className="whitespace-nowrap font-semibold text-[var(--m-head)]">{v}</b> : v) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}

export interface PropsDasSecoes {
  prop: PropertyDTO; d: DerivadosDaFicha;
  /** Lançamento com o book ligado: o bloco na cor principal. */
  mostraBook: boolean; pedirBook: () => void;
}

export default function SecoesDaFichaModerna({ prop, d, mostraBook, pedirBook }: PropsDasSecoes) {
  const { featureLabels, condoLabels, typologies, mapa, regionText, dadosDoPredioList, construtora } = d;
  const paragrafos = paragrafosDaDescricao(prop.description ?? '');
  const temMidia = !!(embedDoVideo(prop.video_url) || embedDoTour(prop.virtual_tour_url));

  return (
    <>
      {(dadosDoPredioList.length > 0 || construtora) && (
        <Secao titulo="Dados do empreendimento">
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {construtora && (
              <div className="min-w-0 rounded-[14px] border border-[var(--m-line)] bg-[var(--m-surface)] px-4 py-3.5">
                <dt className="text-[12px] text-[var(--m-muted)]">Construtora</dt>
                <dd className="font-semibold text-[var(--m-head)]">
                  {construtora.site
                    ? <a href={construtora.site} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">{construtora.nome}</a>
                    : construtora.nome}
                </dd>
              </div>
            )}
            {dadosDoPredioList.map(x => (
              <div key={x.rotulo} className="min-w-0 rounded-[14px] border border-[var(--m-line)] bg-[var(--m-surface)] px-4 py-3.5">
                <dt className="text-[12px] text-[var(--m-muted)]">{x.rotulo}</dt>
                <dd className="font-semibold text-[var(--m-head)]">{x.valor}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}

      {typologies.length > 0 && <Tipologias lista={typologies} />}

      {paragrafos.length > 0 && (
        <Secao titulo="Sobre o imóvel">
          {paragrafos.map((p, i) => (
            <p key={i} className="mb-3 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-[var(--m-text)]">
              <TextoComNegrito texto={p} classeDoNegrito="font-semibold text-[var(--m-head)]" />
            </p>
          ))}
        </Secao>
      )}

      {featureLabels.length > 0 && <Secao titulo="Características"><ListaComCheck itens={featureLabels} /></Secao>}
      {condoLabels.length > 0 && <Secao titulo="Comodidades do condomínio"><ListaComCheck itens={condoLabels} /></Secao>}

      {temMidia && (
        <Secao titulo="Vídeo e tour virtual" id={ID_DA_MIDIA}>
          <div className="-mt-4"><MidiaDoImovel videoUrl={prop.video_url} tourUrl={prop.virtual_tour_url} naColuna /></div>
        </Secao>
      )}

      {mapa && (
        <Secao titulo="Localização">
          {regionText && <p className="-mt-2 mb-3 text-[14px] text-[var(--m-muted)]">{regionText}</p>}
          {/* Revenda: mapa aproximado da região, sem pino. Empreendimento: alfinete no ponto exato. */}
          <div className="overflow-hidden rounded-[20px] border border-[var(--m-line)]">
            <iframe
              title={mapa.exato ? 'Mapa do empreendimento' : 'Mapa da região'} width="100%" height="300" loading="lazy" style={{ border: 0 }}
              src={`https://www.google.com/maps?q=${mapa.q}&z=${mapa.exato ? 16 : 14}&output=embed`}
            />
          </div>
        </Secao>
      )}

      {mostraBook && (
        <div data-testid="bloco-do-book" className="mt-11 grid items-center gap-5 rounded-[28px] bg-[var(--brand)] p-[clamp(24px,4vw,36px)] text-[var(--brand-ink)] sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h3 className="font-[var(--display)] text-[24px] font-semibold leading-tight">Receba o book no WhatsApp</h3>
            <p className="mt-1.5 text-[14px] opacity-80">Plantas, tabela e memorial de {prop.title} direto no seu celular.</p>
          </div>
          <button
            type="button" onClick={pedirBook}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold transition-transform hover:-translate-y-px"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            <Ic d={I.wa} s={18} /> Receber o book no WhatsApp
          </button>
        </div>
      )}
    </>
  );
}
