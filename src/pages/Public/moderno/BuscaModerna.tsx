import { useId } from 'react';
import { I, Ic, ListaDoSite } from '../portalShared';
import type { AbaId } from '@/features/siteBuilder/public/homeConfig';
import { ROTULO_ABA, type BuscaDaCapa, type CampoDeEscolha } from '../home/useBuscaDaCapa';

/* ────────────────────────────────────────────────────────────────────────────
   Busca da capa do Moderno (protótipo `.search`, `.s-tabs`, `.field`): abas e
   código na linha de cima, um campo por filtro com ícone e rótulo, e "Buscar"
   na cor principal. Estado e destino são os do Clássico (`useBuscaDaCapa`).
   Sobre a foto: bloco na superfície do site com sombra. Capa dividida: com
   borda, campos em caixinhas e o botão embaixo, largo.
──────────────────────────────────────────────────────────────────────────── */

const CASA = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z';
const CARTEIRA = 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6';

const ICONE: Record<CampoDeEscolha, string> = {
  type: CASA, city: I.pin, neighborhood: I.pin, price: CARTEIRA,
  bedrooms: I.bed, suites: I.bath, parking: I.car, stage: I.sign,
};

const juntar = (...cls: (string | false)[]) => cls.filter(Boolean).join(' ');

export default function BuscaModerna({ busca, abas, dividida = false }: { busca: BuscaDaCapa; abas: AbaId[]; dividida?: boolean }) {
  const id = useId();
  const { tab, trocarAba, valores, set, selects, temCodigo, runSearch, opcoes } = busca;
  // Uma aba só não é escolha: a fileira some (como no Clássico).
  const comAbas = abas.length > 1;

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

      <div className={juntar('flex flex-col gap-2', !dividida && 'lg:flex-row lg:items-center lg:gap-1')}>
        {selects.length > 0 && (
          <div className={juntar('grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2', dividida ? 'gap-2' : 'lg:grid-cols-4')}>
            {selects.map(c => {
              const o = opcoes[c];
              const campoId = `${id}-${c}`;
              return (
                <div key={c} className={juntar(
                  'flex min-w-0 items-center gap-3 border-[var(--m-line)]',
                  dividida ? 'rounded-[14px] border px-3 py-2' : 'px-3 py-2 lg:px-4 lg:[&:not(:nth-child(4n+1))]:border-l',
                )}>
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
          </div>
        )}
        <button
          type="submit"
          className={juntar(
            'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-6 py-[15px] text-[14px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px',
            !dividida && selects.length === 0 && 'lg:ml-auto',
          )}
        >
          <Ic d={I.search} s={16} /> Buscar
        </button>
      </div>
    </form>
  );
}
