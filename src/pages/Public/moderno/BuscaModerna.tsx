import { useId } from 'react';
import { I, Ic, ListaDoSite } from '../portalShared';
import type { AbaId } from '@/features/siteBuilder/public/homeConfig';
import { ROTULO_ABA, type BuscaDaCapa, type CampoDeEscolha } from '../home/useBuscaDaCapa';

/* ────────────────────────────────────────────────────────────────────────────
   Busca da capa do Moderno (protótipo `.search`, `.s-tabs`, `.field`): abas e
   código na linha de cima, um campo por filtro com ícone e rótulo, e "Buscar"
   na cor principal. Estado e destino são os do Clássico (`useBuscaDaCapa`).
   Os campos são caixinhas iguais numa grade (0 a 8 campos, ver
   `gradeDaBusca`); o "Buscar" tem a altura de uma caixinha e fica no fim da
   última linha. Celular: um por linha e o botão largo no fim. Sobre a foto:
   bloco na superfície do site com sombra. Capa dividida: com borda, 2 por
   linha e o botão embaixo, largo.
──────────────────────────────────────────────────────────────────────────── */

const CASA = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z';
const CARTEIRA = 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6';

const ICONE: Record<CampoDeEscolha, string> = {
  type: CASA, city: I.pin, neighborhood: I.pin, price: CARTEIRA,
  bedrooms: I.bed, suites: I.bath, parking: I.car, stage: I.sign,
};

const juntar = (...cls: (string | false)[]) => cls.filter(Boolean).join(' ');

/** Altura única de campo e botão: o "Buscar" tem a altura de um campo. */
const ALTURA = 'min-h-[60px]';
/** Cada campo é uma caixinha igual (fundo e borda do site, cantos redondos): sem linha solta entre campos. */
const CAIXA = `flex ${ALTURA} min-w-0 items-center gap-3 rounded-[14px] border border-[var(--m-line)] bg-[var(--m-ground)] px-3 py-2 transition-colors focus-within:border-[var(--brand)]`;
/** 2 por linha (tablet; e a capa dividida sempre): o último campo que sobra sozinho ocupa a linha inteira. */
const SOBRA_EM_DUAS = 'sm:[&:nth-child(odd):last-child]:col-span-2';
const SOBRA_SO_NO_TABLET = `${SOBRA_EM_DUAS} lg:[&:nth-child(odd):last-child]:col-span-1`;
/** Classes fixas (o Tailwind só gera o que está escrito). */
const COLUNAS_NO_COMPUTADOR = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4'];

/**
 * Colunas no computador: até 4 por linha, linhas equilibradas (6 campos = 3 + 3,
 * 5 = 3 + 2, 7 = 4 + 3, 8 = 4 + 4). Com a última linha cheia, o "Buscar" fica
 * numa coluna própria à direita, no pé da última linha; com uma vaga sobrando,
 * ele ocupa a vaga (no fim da última linha). Nunca fica solto entre linhas.
 */
function gradeDaBusca(n: number): { colunas: number; botaoNaGrade: boolean } {
  if (n <= 0) return { colunas: 0, botaoNaGrade: false };
  const colunas = Math.ceil(n / Math.ceil(n / 4));
  return { colunas, botaoNaGrade: n % colunas !== 0 };
}

export default function BuscaModerna({ busca, abas, dividida = false }: { busca: BuscaDaCapa; abas: AbaId[]; dividida?: boolean }) {
  const id = useId();
  const { tab, trocarAba, valores, set, selects, temCodigo, runSearch, opcoes } = busca;
  // Uma aba só não é escolha: a fileira some (como no Clássico).
  const comAbas = abas.length > 1;
  const n = selects.length;
  // Capa dividida (coluna estreita): 2 por linha e o botão largo embaixo.
  const { colunas, botaoNaGrade: naGrade } = gradeDaBusca(n);
  const botaoNaGrade = !dividida && naGrade;
  const botao = (cls: string) => (
    <button
      type="submit"
      className={juntar(
        `inline-flex ${ALTURA} items-center justify-center gap-2 rounded-[14px] bg-[var(--brand)] px-6 text-[14px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px`,
        cls,
      )}
    >
      <Ic d={I.search} s={16} /> Buscar
    </button>
  );

  return (
    <form
      role="search" onSubmit={runSearch}
      className={juntar(
        'rounded-[22px] bg-[var(--m-surface)] p-2 text-[var(--m-head)]',
        dividida ? 'border border-[var(--m-line)]' : 'mx-[clamp(12px,3vw,32px)] mb-[clamp(12px,3vw,28px)] shadow-[0_18px_40px_-18px_rgba(8,10,22,0.5)]',
      )}
    >
      {(comAbas || temCodigo) && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--m-line)] px-1.5 pb-2.5 pt-0.5">
          {comAbas ? (
            <div className="flex flex-wrap gap-1">
              {abas.map(k => (
                <button
                  key={k} type="button" aria-pressed={tab === k} onClick={() => trocarAba(k)}
                  className={juntar(
                    'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                    tab === k ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'text-[var(--m-muted)] hover:text-[var(--m-head)]',
                  )}
                >
                  {ROTULO_ABA[k]}
                </button>
              ))}
            </div>
          ) : <span />}
          {temCodigo && (
            <label className="flex items-center gap-2 text-[13px] text-[var(--m-muted)]">
              <Ic d={I.search} s={14} />
              <input
                value={valores.code ?? ''} onChange={e => set('code')(e.target.value)}
                aria-label="Código do imóvel" placeholder="Código do imóvel"
                className="w-[140px] bg-transparent text-[13px] font-semibold text-[var(--m-head)] outline-none placeholder:font-normal placeholder:text-[var(--m-muted)]"
              />
            </label>
          )}
        </div>
      )}

      <div className={juntar('flex flex-col gap-2', !dividida && 'lg:flex-row')}>
        {n > 0 && (
          <div
            data-campos-da-busca
            className={juntar('grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2', !dividida && COLUNAS_NO_COMPUTADOR[colunas])}
          >
            {selects.map(c => {
              const o = opcoes[c];
              const campoId = `${id}-${c}`;
              return (
                <div key={c} data-campo-da-busca className={`${CAIXA} ${dividida ? SOBRA_EM_DUAS : SOBRA_SO_NO_TABLET}`}>
                  <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-[var(--m-brand-soft)] text-[var(--m-head)]">
                    <Ic d={ICONE[c]} s={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={campoId} className="block text-[11.5px] leading-[1.2] text-[var(--m-muted)]">{o.label}</label>
                    <ListaDoSite
                      id={campoId} value={valores[c] ?? ''} onChange={set(c)} vazio="Qualquer" options={o.options}
                      className="w-full min-w-0 appearance-none truncate border-0 bg-transparent pt-0.5 text-[14px] font-semibold text-[var(--m-head)] outline-none [&_option]:text-[#17140F]"
                    />
                  </div>
                </div>
              );
            })}
            {botaoNaGrade && botao('w-full')}
          </div>
        )}
        {!botaoNaGrade && botao(juntar(
          dividida ? 'w-full' : 'w-full lg:w-auto lg:self-end lg:px-7',
          !dividida && n === 0 && 'lg:ml-auto',
        ))}
      </div>
    </form>
  );
}
