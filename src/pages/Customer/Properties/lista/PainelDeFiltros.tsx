// src/pages/Customer/Properties/lista/PainelDeFiltros.tsx
// Painel de filtros da lista de Imóveis. Fica no topo, abre e fecha, e rola
// junto com a página (não gruda). A lista atualiza a cada escolha, sem botão
// "Buscar". Pílulas são botões com aria-pressed: caixinha nativa tem teto no build.
// Preço é digitado: só vai para a lista 400 ms depois da última tecla, como a busca.
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import {
  FASES, SITUACOES,
  type Filtros, type FiltrosEmpreendimento, type FiltrosRevenda, type ListingKind,
} from '@/features/properties/listingKind';

export interface Facetas {
  neighborhoods: string[];
  property_types: string[];
  captors: { id: string; name: string }[];
}

interface Props {
  kind: ListingKind;
  filtros: Filtros;
  facetas: Facetas | null;
  aoMudar: (f: Filtros) => void;
  aoLimpar: () => void;
  aoRecolher: () => void;
}

const campo = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';
const rotulo = 'text-xs font-semibold text-muted-foreground';

function Pilulas<T extends string | number>({ opcoes, marcadas, aoTrocar, rotuloId }: {
  opcoes: { valor: T; rotulo: string }[]; marcadas: T[]; aoTrocar: (l: T[]) => void; rotuloId: string;
}) {
  return (
    <div role="group" aria-labelledby={rotuloId} className="flex flex-wrap gap-1.5">
      {opcoes.map(o => {
        const on = marcadas.includes(o.valor);
        return (
          <button key={String(o.valor)} type="button" aria-pressed={on}
            onClick={() => aoTrocar(on ? marcadas.filter(x => x !== o.valor) : [...marcadas, o.valor])}
            className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'border-input bg-background'}`}>
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

const QUARTOS = [1, 2, 3, 4].map(n => ({ valor: n, rotulo: n === 4 ? '4+' : String(n) }));
const soDigitos = (v: string) => v.replace(/\D/g, '');
export const ATRASO_DO_PRECO = 400;

// Campo de preço com o valor local: cada tecla muda a caixa na hora, e a lista
// só recebe o número depois da pausa. Fechar o painel no meio entrega o pendente.
function CampoDePreco({ valor, aoConfirmar, ...resto }: {
  valor: string; aoConfirmar: (v: string) => void; 'aria-label': string; placeholder: string;
}) {
  const [texto, setTexto] = useState(valor);
  const pendente = useRef<{ timer: ReturnType<typeof setTimeout>; v: string } | null>(null);
  // Sempre o aoConfirmar mais novo: ele monta os filtros a partir dos atuais.
  const confirmar = useRef(aoConfirmar);
  confirmar.current = aoConfirmar;

  // Valor trocado por fora (Limpar filtros, etiqueta tirada).
  useEffect(() => { setTexto(valor); }, [valor]);
  useEffect(() => () => {
    if (pendente.current) { clearTimeout(pendente.current.timer); confirmar.current(pendente.current.v); }
  }, []);

  const mudar = (bruto: string) => {
    const v = soDigitos(bruto);
    setTexto(v);
    if (pendente.current) clearTimeout(pendente.current.timer);
    pendente.current = {
      v,
      timer: setTimeout(() => { pendente.current = null; confirmar.current(v); }, ATRASO_DO_PRECO),
    };
  };
  return <input {...resto} className={campo} inputMode="numeric" value={texto} onChange={e => mudar(e.target.value)} />;
}

export default function PainelDeFiltros({ kind, filtros, facetas, aoMudar, aoLimpar, aoRecolher }: Props) {
  const id = useId();
  // O preço chega depois da pausa: monta a partir dos filtros de AGORA, não dos
  // da tecla (uma pílula marcada nesse meio não pode ser desfeita).
  const atuais = useRef(filtros);
  atuais.current = filtros;
  const bairros = facetas?.neighborhoods ?? [];
  const situacoes = SITUACOES[kind];

  const corpo = kind === 'development' ? (() => {
    const f = filtros as FiltrosEmpreendimento;
    const set = (p: Partial<FiltrosEmpreendimento>) => aoMudar({ ...(atuais.current as FiltrosEmpreendimento), ...p });
    const anos = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i));
    return (
      <>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span id={`${id}-fase`} className={rotulo}>Fase da obra</span>
          <Pilulas rotuloId={`${id}-fase`} opcoes={FASES} marcadas={f.fases as string[]} aoTrocar={fases => set({ fases })} />
        </div>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Bairro</span>
          <Seletor className={campo} value={f.bairro} onChange={e => set({ bairro: e.target.value })}>
            <option value="">Todos</option>{bairros.map(b => <option key={b}>{b}</option>)}
          </Seletor></label>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Situação</span>
          <Seletor className={campo} value={f.situacao} onChange={e => set({ situacao: e.target.value })}>
            <option value="">Todas</option>{situacoes.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          </Seletor></label>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><span className={rotulo}>Preço das unidades</span>
          <div className="grid grid-cols-2 gap-2">
            <CampoDePreco aria-label="Preço a partir de" placeholder="A partir de R$" valor={f.precoMin} aoConfirmar={precoMin => set({ precoMin })} />
            <CampoDePreco aria-label="Preço até" placeholder="Até R$" valor={f.precoMax} aoConfirmar={precoMax => set({ precoMax })} />
          </div></div>
        <div className="flex flex-col gap-1.5"><span id={`${id}-dorms`} className={rotulo}>Dormitórios (qualquer tipologia)</span>
          <Pilulas rotuloId={`${id}-dorms`} opcoes={QUARTOS} marcadas={f.quartos} aoTrocar={quartos => set({ quartos })} /></div>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Entrega até</span>
          <Seletor className={campo} value={f.entregaAte} onChange={e => set({ entregaAte: e.target.value })}>
            <option value="">Qualquer data</option>{anos.map(a => <option key={a}>{a}</option>)}
          </Seletor></label>
      </>
    );
  })() : (() => {
    const f = filtros as FiltrosRevenda;
    const set = (p: Partial<FiltrosRevenda>) => aoMudar({ ...(atuais.current as FiltrosRevenda), ...p });
    const precoRotulo = f.finalidade === 'locacao' ? 'Preço do aluguel' : f.finalidade === 'venda' ? 'Preço de venda' : 'Preço (venda ou aluguel)';
    return (
      <>
        <div className="flex flex-col gap-1.5"><span id={`${id}-finalidade`} className={rotulo}>Finalidade</span>
          <div role="group" aria-labelledby={`${id}-finalidade`} className="flex flex-wrap gap-1.5">
            {([['', 'Todas'], ['venda', 'Venda'], ['locacao', 'Locação']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={f.finalidade === v} onClick={() => set({ finalidade: v })}
                className={`rounded-full border px-3 py-1 text-xs ${f.finalidade === v ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'border-input bg-background'}`}>{l}</button>
            ))}
          </div></div>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Tipo</span>
          <Seletor className={campo} value={f.tipo} onChange={e => set({ tipo: e.target.value })}>
            <option value="">Todos</option>
            {(facetas?.property_types ?? []).map(t => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t] ?? t}</option>)}
          </Seletor></label>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Bairro</span>
          <Seletor className={campo} value={f.bairro} onChange={e => set({ bairro: e.target.value })}>
            <option value="">Todos</option>{bairros.map(b => <option key={b}>{b}</option>)}
          </Seletor></label>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Situação</span>
          <Seletor className={campo} value={f.situacao} onChange={e => set({ situacao: e.target.value })}>
            <option value="">Todas</option>{situacoes.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          </Seletor></label>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><span className={rotulo}>{precoRotulo}</span>
          <div className="grid grid-cols-2 gap-2">
            <CampoDePreco aria-label="Preço de" placeholder="De R$" valor={f.precoMin} aoConfirmar={precoMin => set({ precoMin })} />
            <CampoDePreco aria-label="Preço até" placeholder="Até R$" valor={f.precoMax} aoConfirmar={precoMax => set({ precoMax })} />
          </div></div>
        <div className="flex flex-col gap-1.5"><span id={`${id}-dorms`} className={rotulo}>Dormitórios</span>
          <Pilulas rotuloId={`${id}-dorms`} opcoes={QUARTOS} marcadas={f.quartos} aoTrocar={quartos => set({ quartos })} /></div>
        <div className="flex flex-col gap-1.5"><span id={`${id}-vagas`} className={rotulo}>Vagas</span>
          <Pilulas rotuloId={`${id}-vagas`} opcoes={QUARTOS} marcadas={f.vagas} aoTrocar={vagas => set({ vagas })} /></div>
        <label className="flex flex-col gap-1.5"><span className={rotulo}>Captador</span>
          <Seletor aria-label="Captador" className={campo} value={f.captador} onChange={e => set({ captador: e.target.value })}>
            <option value="">Todos</option>{(facetas?.captors ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Seletor></label>
      </>
    );
  })();

  return (
    <section aria-label="Filtros" className="mt-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{corpo}</div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <span className="mr-auto text-xs text-muted-foreground">A lista atualiza enquanto você escolhe.</span>
        <Button variant="ghost" onClick={aoLimpar}>Limpar filtros</Button>
        <Button variant="outline" onClick={aoRecolher}>Recolher</Button>
      </div>
    </section>
  );
}
