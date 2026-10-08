// ── ESCOLHA COM BUSCA ────────────────────────────────────────────────────────
//
// Mesma escolha da EtiquetasDeEscolha (liga e desliga uma a uma), para listas que
// crescem sem limite (etiquetas da conta). Com poucas opções, mostra todas, igual
// às outras seções. Com muitas: as escolhidas ficam em cima com ✕ e as demais só
// aparecem pela busca, no máximo LIMITE por vez. Enter escolhe a primeira.
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/ds';
import EtiquetasDeEscolha from './EtiquetasDeEscolha';

export interface EscolhaComBuscaProps {
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  escolhidas: string[];
  aoMudar: (escolhidas: string[]) => void;
  placeholder: string;
  /** Até quantas opções mostra todas, sem busca. */
  semBuscaAte?: number;
}

const LIMITE = 5;

const normal = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function EscolhaComBusca({
  rotulo, opcoes, escolhidas, aoMudar, placeholder, semBuscaAte = 5,
}: EscolhaComBuscaProps) {
  const [busca, setBusca] = useState('');
  const termo = normal(busca.trim());

  const achadas = useMemo(
    () => (termo ? opcoes.filter(o => !escolhidas.includes(o.valor) && normal(o.rotulo).includes(termo)) : []),
    [opcoes, escolhidas, termo],
  );

  if (opcoes.length <= semBuscaAte) {
    return <EtiquetasDeEscolha rotulo={rotulo} opcoes={opcoes} escolhidas={escolhidas} aoMudar={aoMudar} />;
  }

  const porValor = new Map(opcoes.map(o => [o.valor, o.rotulo]));
  const escolher = (valor: string) => {
    aoMudar([...escolhidas, valor]);
    setBusca('');
  };

  return (
    <div className="space-y-3">
      {escolhidas.length > 0 && (
        <div role="group" aria-label={`${rotulo} escolhidas`} className="flex flex-wrap gap-2">
          {escolhidas.map(v => {
            const nome = porValor.get(v) ?? v;
            return (
              <span key={v} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-primary bg-primary/5 px-3.5 py-1.5 text-sm font-medium text-primary">
                {nome}
                <button type="button" aria-label={`Tirar ${nome}`} onClick={() => aoMudar(escolhidas.filter(x => x !== v))}
                  className="-mr-1 rounded-full p-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label={`Buscar ${rotulo.toLowerCase()}`} placeholder={placeholder} value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (achadas[0]) escolher(achadas[0].valor); } }}
          className="pl-9" />
      </div>

      {termo && (achadas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada encontrado.</p>
      ) : (
        <>
          <EtiquetasDeEscolha rotulo={rotulo} opcoes={achadas.slice(0, LIMITE)} escolhidas={[]} aoMudar={v => escolher(v[0])} />
          {achadas.length > LIMITE && (
            <p className="text-xs text-muted-foreground">Mais {achadas.length - LIMITE}. Continue digitando para achar.</p>
          )}
        </>
      ))}
    </div>
  );
}
