import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { I, Ic, ListaDoSite } from '../portalShared';
import type { AbaId } from '@/features/siteBuilder/public/homeConfig';
import { normalizarTexto } from '@/features/siteBuilder/public/filtros';
import { ROTULO_ABA, type BuscaDaCapa, type CampoDeEscolha } from '../home/useBuscaDaCapa';

/* ────────────────────────────────────────────────────────────────────────────
   Busca da capa do Moderno (protótipo `.search`, `.s-tabs`, `.field`), com a
   barra de pesquisa grande que o Tony pediu em 13/11:
   1. Abas (Comprar, Alugar, Lançamentos).
   2. A barra grande: "Digite cidade, bairro ou código do imóvel" e o
      "Buscar" ao lado (no celular, largo embaixo). Enquanto digita, uma
      lista de sugestões com as cidades e os bairros do site (mesma
      comparação da busca, sem acento nem maiúscula: `normalizarTexto`).
      Escolher uma sugestão preenche o campo Cidade ou Bairro (não busca
      sozinho). No Buscar, o texto livre vira bairro, senão cidade, senão
      código (a página de imóveis só entende esses filtros).
   3. Os filtros numa linha, separados por linhas finas (--m-line), cada um
      com ícone redondo, rótulo pequeno e valor em negrito (corta com
      reticências). Até 1023px: 3 por linha; no celular, um por linha.
   Estado e destino são os do Clássico (`useBuscaDaCapa`). Capa dividida:
   com borda, filtros em caixinhas 2 por linha.
──────────────────────────────────────────────────────────────────────────── */

const CASA = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z';
const CARTEIRA = 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6';

const ICONE: Record<CampoDeEscolha, string> = {
  type: CASA, city: I.pin, neighborhood: I.pin, price: CARTEIRA,
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

/** No máximo 8 sugestões, a partir de 2 letras. */
const MAX_SUGESTOES = 8;
const MIN_LETRAS = 2;

type Lugar = 'city' | 'neighborhood';
interface Sugestao { campo: Lugar; valor: string }
const ROTULO_DO_LUGAR: Record<Lugar, string> = { city: 'Cidade', neighborhood: 'Bairro' };

/**
 * Cidades e bairros do site que contêm o texto (sem acento nem maiúscula).
 * Os que começam pelo texto vêm antes; depois cidade antes de bairro, e a
 * ordem alfabética.
 */
function sugestoesDaBusca(texto: string, cities: string[], hoods: string[]): Sugestao[] {
  const q = normalizarTexto(texto);
  if (q.length < MIN_LETRAS) return [];
  const vistos = new Set<string>();
  const achados: { s: Sugestao; inicio: boolean }[] = [];
  const procurar = (campo: Lugar, lista: string[]) => {
    for (const valor of lista) {
      const n = normalizarTexto(valor);
      const chave = `${campo}:${n}`;
      if (!n || vistos.has(chave) || !n.includes(q)) continue;
      vistos.add(chave);
      achados.push({ s: { campo, valor }, inicio: n.startsWith(q) });
    }
  };
  procurar('city', cities);
  procurar('neighborhood', hoods);
  return achados
    .sort((a, b) => Number(b.inicio) - Number(a.inicio)
      || (a.s.campo === b.s.campo ? 0 : a.s.campo === 'city' ? -1 : 1)
      || a.s.valor.localeCompare(b.s.valor, 'pt-BR'))
    .slice(0, MAX_SUGESTOES)
    .map(a => a.s);
}

export default function BuscaModerna({ busca, abas, dividida = false }: { busca: BuscaDaCapa; abas: AbaId[]; dividida?: boolean }) {
  const id = useId();
  const { tab, trocarAba, valores, set, selects, irParaBusca, opcoes, cities, hoods } = busca;
  // Uma aba só não é escolha: a fileira some (como no Clássico).
  const comAbas = abas.length > 1;
  const n = selects.length;

  const [texto, setTexto] = useState('');
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  // O texto veio de uma sugestão: trocar o mesmo campo embaixo apaga o texto (senão ele venceria no Buscar).
  const [escolha, setEscolha] = useState<Sugestao | null>(null);
  const sugestoes = useMemo(() => sugestoesDaBusca(texto, cities, hoods), [texto, cities, hoods]);
  const listaAberta = aberta && sugestoes.length > 0;
  const listaId = `${id}-sugestoes`;

  const fechar = () => { setAberta(false); setAtivo(-1); };
  const escolher = (s: Sugestao) => {
    set(s.campo)(s.valor);
    setTexto(s.valor);
    setEscolha(s);
    fechar();
  };
  const mudarCampo = (c: CampoDeEscolha) => (v: string) => {
    set(c)(v);
    if (escolha?.campo === c) { setTexto(''); setEscolha(null); }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    fechar();
    const t = texto.trim();
    if (!t) return irParaBusca();
    const alvo = normalizarTexto(t);
    const bairro = hoods.find(h => normalizarTexto(h) === alvo);
    if (bairro) return irParaBusca({ neighborhood: bairro });
    const cidade = cities.find(c => normalizarTexto(c) === alvo);
    if (cidade) return irParaBusca({ city: cidade });
    return irParaBusca({ code: t });
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugestoes.length) return;
      e.preventDefault();
      const desce = e.key === 'ArrowDown';
      if (!listaAberta) { setAberta(true); setAtivo(desce ? 0 : sugestoes.length - 1); return; }
      setAtivo(i => (desce ? (i + 1) % sugestoes.length : (i <= 0 ? sugestoes.length - 1 : i - 1)));
    } else if (e.key === 'Enter' && listaAberta && ativo >= 0) {
      e.preventDefault();
      escolher(sugestoes[ativo]);
    } else if (e.key === 'Escape' && listaAberta) {
      e.preventDefault();
      fechar();
    }
  };

  return (
    <form
      role="search" onSubmit={enviar}
      className={juntar(
        'rounded-[22px] bg-[var(--m-surface)] p-2.5 text-[var(--m-head)]',
        dividida ? 'border border-[var(--m-line)]' : 'mb-[clamp(16px,3vw,32px)] shadow-[0_18px_40px_-18px_rgba(8,10,22,0.5)]',
      )}
    >
      {comAbas && (
        <div className="flex flex-wrap gap-1 px-0.5 pb-2.5">
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
      )}

      {/* A barra grande e o Buscar. */}
      <div data-barra-da-busca className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--m-muted)]"><Ic d={I.search} s={20} /></span>
          <input
            type="text" role="combobox" autoComplete="off" spellCheck={false}
            aria-label="Cidade, bairro ou código do imóvel"
            aria-expanded={listaAberta} aria-controls={listaId} aria-autocomplete="list"
            aria-activedescendant={listaAberta && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
            placeholder="Digite cidade, bairro ou código do imóvel"
            value={texto}
            onChange={e => { setTexto(e.target.value); setEscolha(null); setAberta(true); setAtivo(-1); }}
            onFocus={() => setAberta(true)}
            onBlur={fechar}
            onKeyDown={teclas}
            className="h-[62px] w-full min-w-0 text-ellipsis rounded-2xl border border-[var(--m-line)] bg-[var(--m-ground)] pl-[54px] pr-4 text-[16px] font-medium text-[var(--m-head)] outline-none transition-colors placeholder:font-normal placeholder:text-[var(--m-muted)] focus:border-[var(--brand)] sm:text-[17px]"
          />
          {listaAberta && (
            <div
              id={listaId} role="listbox" aria-label="Sugestões de cidade e bairro"
              className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[14px] border border-[var(--m-line)] bg-[var(--m-surface)] p-1.5 shadow-[0_18px_40px_-18px_rgba(8,10,22,0.45)]"
            >
              {sugestoes.map((s, i) => (
                <div
                  key={`${s.campo}:${s.valor}`} id={`${listaId}-${i}`} role="option" aria-selected={i === ativo}
                  // mousedown: escolhe antes de a barra perder o foco (o blur fecharia a lista).
                  onMouseDown={e => { e.preventDefault(); escolher(s); }}
                  onMouseEnter={() => setAtivo(i)}
                  className={juntar(
                    'flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px]',
                    i === ativo && 'bg-[var(--m-brand-soft)]',
                  )}
                >
                  <span className="flex-none text-[var(--m-muted)]"><Ic d={I.pin} s={16} /></span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--m-head)]">{s.valor}</span>
                  <span className="flex-none text-[12px] text-[var(--m-muted)]">{ROTULO_DO_LUGAR[s.campo]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
          {selects.map(c => {
            const o = opcoes[c];
            const campoId = `${id}-${c}`;
            return (
              <div key={c} data-campo-da-busca className={juntar(
                'flex min-w-0 items-center gap-2.5 px-3 py-1.5',
                dividida ? 'rounded-[14px] border border-[var(--m-line)]' : `lg:min-w-0 lg:flex-1 lg:basis-0 ${DIVISORIAS}`,
              )}>
                <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-[var(--m-brand-soft)] text-[var(--m-head)]">
                  <Ic d={ICONE[c]} s={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <label htmlFor={campoId} className="block truncate text-[11px] leading-[1.2] text-[var(--m-muted)]">{o.label}</label>
                  <ListaDoSite
                    id={campoId} value={valores[c] ?? ''} onChange={mudarCampo(c)} vazio="Qualquer" options={o.options}
                    className="w-full min-w-0 appearance-none truncate border-0 bg-transparent pt-0.5 text-[13.5px] font-semibold text-[var(--m-head)] outline-none [&_option]:bg-[#FFFFFF] [&_option]:text-[#17140F]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
