import { useId } from 'react';
import { I, Ic, ListaDoSite } from '../portalShared';
import type { AbaId } from '@/features/siteBuilder/public/homeConfig';
import CampoDeLugar from '../CampoDeLugar';
import { ROTULO_ABA, type BuscaDaCapa, type CampoDeEscolha } from '../home/useBuscaDaCapa';

/* ────────────────────────────────────────────────────────────────────────────
   Busca da capa do Moderno (protótipo `.search`, `.s-tabs`, `.field`), com a
   barra de pesquisa grande que o Tony pediu em 13/11:
   1. Abas (Comprar, Alugar, Lançamentos) e, quando há, "Mais filtros".
   2. A barra grande, sempre visível: "Digite condomínio, bairro, cidade ou
      código" e o "Buscar" ao lado (no celular, largo embaixo). É o mesmo
      campo de lugar do Clássico (`CampoDeLugar`, sugestões agrupadas em
      Condomínio, Bairro e Cidade). Escolher uma sugestão guarda a escolha
      (não busca sozinho); no Buscar, a sugestão vai com os filtros dela, o
      código de um imóvel publicado vira `code` e o resto vira `place`
      (`runSearch` em `useBuscaDaCapa`). Decisão do Tony em 13/11: um campo
      só, o nosso padrão.
   3. Os filtros numa linha, separados por linhas finas (--m-line), cada um
      com ícone redondo, rótulo pequeno e valor em negrito (corta com
      reticências). Até 1023px: 3 por linha; no celular, um por linha. O
      lugar nunca é célula aqui (a barra é ele).
   Estado e destino são os do Clássico (`useBuscaDaCapa`). Capa dividida:
   com borda, filtros em caixinhas 2 por linha.
──────────────────────────────────────────────────────────────────────────── */

const CASA = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z';
const CARTEIRA = 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6';

const ICONE: Record<CampoDeEscolha, string> = {
  type: CASA, city: I.pin, neighborhood: I.pin, place: I.search, area: I.search, price: CARTEIRA,
  bedrooms: I.bed, suites: I.bath, parking: I.car, stage: I.sign,
};

const juntar = (...cls: (string | false)[]) => cls.filter(Boolean).join(' ');

/** Divisórias da linha de filtros: só entre filtros da mesma linha (e entre as linhas, até 1023px). */
const DIVISORIAS = [
  'border-[var(--m-line)]',
  'max-sm:[&:not(:first-child)]:border-t',
  'sm:max-lg:[&:not(:nth-child(3n+1))]:border-l sm:max-lg:[&:nth-child(n+4)]:border-t',
  'lg:[&:not(:first-child)]:border-l',
].join(' ');
/** Colunas até 1023px: até 3 (classes fixas: o Tailwind só gera o que está escrito). */
const COLUNAS_NO_TABLET = ['', 'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3'];

/** A barra grande por cima do visual do campo de lugar (lupa, moldura, altura e lista). */
const BARRA_GRANDE = [
  'min-w-0 flex-1',
  '[&>span]:left-5 [&>span]:text-[var(--m-muted)]',
  '[&_input]:h-[62px] [&_input]:text-ellipsis [&_input]:rounded-2xl [&_input]:border-[var(--m-line)] [&_input]:bg-[var(--m-ground)]',
  '[&_input]:py-0 [&_input]:pl-[50px] [&_input]:pr-4 [&_input]:text-[16px] sm:[&_input]:text-[17px] [&_input]:font-medium [&_input]:text-[var(--m-head)]',
  '[&_input]:placeholder:font-normal [&_input]:placeholder:text-[var(--m-muted)]',
  // Celular: o exemplo inteiro ("… ou código") cabe na largura de 390px, sem reticências.
  'max-sm:[&>span]:left-4 max-sm:[&_input]:pl-[44px] max-sm:[&_input]:pr-3 max-sm:[&_input]:placeholder:text-[13px]',
  '[&_[role=listbox]]:mt-2 [&_[role=listbox]]:rounded-[14px] [&_[role=listbox]]:text-[#17140F]',
].join(' ');

export default function BuscaModerna({ busca, abas, dividida = false }: { busca: BuscaDaCapa; abas: AbaId[]; dividida?: boolean }) {
  const id = useId();
  const { tab, trocarAba, valores, set, primeira, mais, abertos, alternarMais, escolherLugar, items, runSearch, opcoes } = busca;
  // Uma aba só não é escolha: a fileira some (como no Clássico).
  const comAbas = abas.length > 1;
  const n = primeira.length;
  const celula = (c: CampoDeEscolha, caixinha: boolean) => {
    const o = opcoes[c];
    const campoId = `${id}-${c}`;
    return (
      <div key={c} data-campo-da-busca className={juntar(
        'flex min-w-0 items-center gap-2.5 px-3 py-1.5',
        caixinha ? 'rounded-[14px] border border-[var(--m-line)]' : `lg:min-w-0 lg:flex-1 lg:basis-0 ${DIVISORIAS}`,
      )}>
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-[var(--m-brand-soft)] text-[var(--m-head)]">
          <Ic d={ICONE[c]} s={15} />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={campoId} className="block truncate text-[11px] leading-[1.2] text-[var(--m-muted)]">{o.label}</label>
          <ListaDoSite
            id={campoId} value={valores[c] ?? ''} onChange={set(c)} vazio="Qualquer" options={o.options}
            className="w-full min-w-0 appearance-none truncate border-0 bg-transparent pt-0.5 text-[13.5px] font-semibold text-[var(--m-head)] outline-none [&_option]:bg-[#FFFFFF] [&_option]:text-[#17140F]"
          />
        </div>
      </div>
    );
  };

  return (
    <form
      role="search" onSubmit={runSearch}
      className={juntar(
        'rounded-[22px] bg-[var(--m-surface)] p-2.5 text-[var(--m-head)]',
        dividida ? 'border border-[var(--m-line)]' : 'mb-[clamp(16px,3vw,32px)] shadow-[0_18px_40px_-18px_rgba(8,10,22,0.5)]',
      )}
    >
      {(comAbas || mais.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-1 px-0.5 pb-2.5">
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
          {mais.length > 0 && (
            <button
              type="button" onClick={alternarMais} aria-expanded={abertos}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[var(--m-muted)] transition-colors hover:text-[var(--m-head)]"
            >
              {abertos ? 'Menos filtros' : 'Mais filtros'}
            </button>
          )}
        </div>
      )}

      {/* A barra grande (o campo de lugar, que também aceita código) e o Buscar. */}
      <div data-barra-da-busca className="flex flex-col gap-2 sm:flex-row">
        <CampoDeLugar
          items={items} tab={tab} texto={valores.place ?? ''} onTexto={set('place')} onEscolher={escolherLugar}
          rotulo="Condomínio, bairro, cidade ou código" placeholder="Digite condomínio, bairro, cidade ou código"
          className={BARRA_GRANDE}
        />
        <button
          type="submit"
          className="inline-flex h-[62px] flex-none items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-8 text-[16px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px"
        >
          <Ic d={I.search} s={18} /> Buscar
        </button>
      </div>

      {n > 0 && (
        <div
          data-campos-da-busca
          className={juntar(
            'mt-2 grid min-w-0 grid-cols-1',
            dividida ? 'gap-2 sm:grid-cols-2' : `${COLUNAS_NO_TABLET[Math.min(n, 3)] ?? ''} lg:flex lg:items-stretch`,
          )}
        >
          {primeira.map(c => celula(c, dividida))}
        </div>
      )}

      {abertos && mais.length > 0 && (
        <div data-campos-da-busca-mais className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {mais.map(c => celula(c, true))}
        </div>
      )}
    </form>
  );
}
