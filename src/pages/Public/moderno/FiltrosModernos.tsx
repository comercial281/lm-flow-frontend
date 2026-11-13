import { useId, useState } from 'react';
import { ListaDoSite, type PortalTab } from '../portalShared';
import { opcaoDoTipo, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { FASES_DO_PUBLICO } from '@/features/properties/listingKind';
import type { BuscaDosImoveis } from '../busca/useBuscaDosImoveis';
import { AREAS_MINIMAS } from '@/features/siteBuilder/public/filtros';
import CampoDeLugar, { EXEMPLO_DA_CAIXA, ROTULO_DA_CAIXA } from '../CampoDeLugar';

/* ────────────────────────────────────────────────────────────────────────────
   Painel de filtros da página de Imóveis do Moderno (protótipo `.filters`,
   `.f-row`, `.f-more`, `.sel`): abas em cima; o campo "Condomínio, bairro,
   cidade ou código" (o mesmo do Clássico e da capa, com o "×" que tira o
   lugar ou o código; uma caixa de texto só, decisão do Tony em 13/11, então
   o campo de código separado saiu); 5 filtros à vista (Tipo, Cidade, Bairro, Dormitórios,
   Faixa de preço); "Mais filtros" abre Área, Suítes, Vagas e Fase (Fase só
   fora de Alugar). Os filtros valem na hora,
   como no Clássico: não há botão Buscar. Valores e destinos são os do
   `useBuscaDosImoveis` (mesma URL do Clássico).
──────────────────────────────────────────────────────────────────────────── */

const ROTULO_ABA: Record<PortalTab, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
export const DORMITORIOS: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']];
export const MAIS_DE: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

const LISTA = 'w-full min-w-0 appearance-none truncate border-0 bg-transparent pt-0.5 text-[13.5px] font-semibold text-[var(--m-head)] outline-none [&_option]:bg-[#FFFFFF] [&_option]:text-[#17140F]';

/** O campo de lugar no visual do Moderno (moldura, fundo e cores do painel). */
const LUGAR = [
  '[&>span]:text-[var(--m-muted)]',
  '[&_input]:h-12 [&_input]:rounded-[14px] [&_input]:border-[var(--m-line)] [&_input]:bg-[var(--m-ground)]',
  '[&_input]:text-[14px] [&_input]:text-[var(--m-head)] [&_input]:placeholder:text-[var(--m-muted)]',
  '[&_[role=listbox]]:text-[#17140F]',
].join(' ');

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
  const {
    abas, listaOk, filters, update, trocarAba, types, cidade, bairro, preco,
    items, textoDoLugar, setTextoDoLugar, escolherLugar, confirmarLugar, limparLugar,
  } = busca;
  // Abre sozinho quando um dos filtros de dentro já está na URL (link colado, voltar do navegador).
  const algumDeDentro = !!(filters.area || filters.suites || filters.parking || filters.stage);
  const [aberto, setAberto] = useState(algumDeDentro);
  const maisAberto = aberto || algumDeDentro;
  const maisId = useId();
  // Uma aba só não é escolha; na lista (/imoveis/a-venda/...) o negócio é o do caminho.
  const comAbas = abas.length > 1 && !listaOk;

  return (
    <div className="grid gap-2.5 rounded-[22px] border border-[var(--m-line)] bg-[var(--m-surface)] p-3">
      {/* Uma aba só não é escolha: sem abas, a fileira de cima some (o código mora no campo de lugar). */}
      {comAbas && (
        <div className="flex flex-wrap gap-1 border-b border-[var(--m-line)] pb-2.5">
          {abas.map(k => (
            <button
              key={k} type="button" aria-pressed={filters.tab === k} onClick={() => trocarAba(k)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${filters.tab === k ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'text-[var(--m-muted)] hover:text-[var(--m-head)]'}`}
            >
              {ROTULO_ABA[k]}
            </button>
          ))}
        </div>
      )}

      <CampoDeLugar
        items={items} tab={filters.tab} texto={textoDoLugar} rotulo={ROTULO_DA_CAIXA} placeholder={EXEMPLO_DA_CAIXA}
        onTexto={setTextoDoLugar} onEscolher={escolherLugar} onConfirmar={confirmarLugar} onLimpar={limparLugar}
        className={LUGAR}
      />

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
          <Campo rotulo="Área" value={filters.area ?? ''} onChange={v => update({ area: v })} options={AREAS_MINIMAS} />
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
