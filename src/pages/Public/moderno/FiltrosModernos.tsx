import { useId, useState } from 'react';
import { I, Ic, ListaDoSite, type PortalTab } from '../portalShared';
import { opcaoDoTipo, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { FASES_DO_PUBLICO } from '@/features/properties/listingKind';
import type { BuscaDosImoveis } from '../busca/useBuscaDosImoveis';

/* ────────────────────────────────────────────────────────────────────────────
   Painel de filtros da página de Imóveis do Moderno (protótipo `.filters`,
   `.f-row`, `.f-more`, `.sel`): abas e código em cima; 5 filtros à vista
   (Tipo, Cidade, Bairro, Dormitórios, Faixa de preço); "Mais filtros" abre
   Suítes, Vagas e Fase (Fase só fora de Alugar). Os filtros valem na hora,
   como no Clássico: não há botão Buscar. Valores e destinos são os do
   `useBuscaDosImoveis` (mesma URL do Clássico).
──────────────────────────────────────────────────────────────────────────── */

const ROTULO_ABA: Record<PortalTab, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
export const DORMITORIOS: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']];
export const MAIS_DE: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

const LISTA = 'w-full min-w-0 appearance-none truncate border-0 bg-transparent pt-0.5 text-[13.5px] font-semibold text-[var(--m-head)] outline-none [&_option]:bg-[#FFFFFF] [&_option]:text-[#17140F]';

function Campo({ rotulo, value, onChange, options }: { rotulo: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = useId();
  return (
    <div className="relative min-w-0 rounded-[14px] border border-[var(--m-line)] bg-[var(--m-surface)] px-3 py-2 focus-within:border-[var(--brand)]">
      <label htmlFor={id} className="block truncate text-[11px] leading-[1.2] text-[var(--m-muted)]">{rotulo}</label>
      <ListaDoSite id={id} value={value} onChange={onChange} vazio="Qualquer" options={options} className={`${LISTA} pr-5`} />
      <span className="pointer-events-none absolute bottom-2.5 right-3 text-[var(--m-muted)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </div>
  );
}

export default function FiltrosModernos({ busca }: { busca: BuscaDosImoveis }) {
  const { abas, listaOk, filters, update, trocarAba, types, cidade, bairro, preco } = busca;
  // Abre sozinho quando um dos filtros de dentro já está na URL (link colado, voltar do navegador).
  const algumDeDentro = !!(filters.suites || filters.parking || filters.stage);
  const [aberto, setAberto] = useState(algumDeDentro);
  const maisAberto = aberto || algumDeDentro;
  const maisId = useId();
  // Uma aba só não é escolha; na lista (/imoveis/a-venda/...) o negócio é o do caminho.
  const comAbas = abas.length > 1 && !listaOk;

  return (
    <div className="grid gap-2.5 rounded-[22px] border border-[var(--m-line)] bg-[var(--m-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--m-line)] pb-2.5">
        {comAbas ? (
          <div className="flex flex-wrap gap-1">
            {abas.map(k => (
              <button
                key={k} type="button" aria-pressed={filters.tab === k} onClick={() => trocarAba(k)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${filters.tab === k ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'text-[var(--m-muted)] hover:text-[var(--m-head)]'}`}
              >
                {ROTULO_ABA[k]}
              </button>
            ))}
          </div>
        ) : <span />}
        <label className="relative flex w-full items-center sm:w-[240px]">
          <span className="pointer-events-none absolute left-3 text-[var(--m-muted)]"><Ic d={I.search} s={16} /></span>
          <span className="sr-only">Código do imóvel</span>
          <input
            value={filters.code} onChange={e => update({ code: e.target.value }, true)} placeholder="Código do imóvel"
            className="h-10 w-full rounded-full border border-[var(--m-line)] bg-[var(--m-ground)] pl-9 pr-3 text-[13.5px] text-[var(--m-head)] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--brand)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Campo rotulo="Tipo" value={opcaoDoTipo(types, filters.type)} onChange={v => update({ type: v })} options={opcoesDeTipo(types)} />
        <Campo rotulo="Cidade" value={cidade.valor} onChange={v => update({ city: v })} options={cidade.opcoes} />
        <Campo rotulo="Bairro" value={bairro.valor} onChange={v => update({ neighborhood: v })} options={bairro.opcoes} />
        <Campo rotulo="Dormitórios" value={filters.bedrooms} onChange={v => update({ bedrooms: v })} options={DORMITORIOS} />
        <Campo
          rotulo="Faixa de preço" value={preco.valor} options={preco.opcoes}
          onChange={v => update({ price_min: '', price_max: '', ...precoDaFaixa(filters.tab, v) })}
        />
      </div>

      {maisAberto && (
        <div id={maisId} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Suítes" value={filters.suites ?? ''} onChange={v => update({ suites: v })} options={MAIS_DE} />
          <Campo rotulo="Vagas" value={filters.parking ?? ''} onChange={v => update({ parking: v })} options={MAIS_DE} />
          {/* Fase é de empreendimento, e Alugar não tem empreendimento. */}
          {filters.tab !== 'rent' && (
            <Campo rotulo="Fase" value={filters.stage ?? ''} onChange={v => update({ stage: v })} options={FASES_DO_PUBLICO.map(x => [x.valor, x.rotulo])} />
          )}
        </div>
      )}

      <div>
        <button
          type="button" aria-expanded={maisAberto} aria-controls={maisId} onClick={() => setAberto(!maisAberto)}
          className="inline-flex items-center gap-1.5 px-1.5 py-1 text-[13px] font-semibold text-[var(--m-head)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={maisAberto ? 'M5 12h14' : 'M12 5v14M5 12h14'} />
          </svg>
          Mais filtros
        </button>
      </div>
    </div>
  );
}
