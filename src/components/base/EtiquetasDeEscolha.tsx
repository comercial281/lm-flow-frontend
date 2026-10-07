// ── ETIQUETAS DE ESCOLHA ─────────────────────────────────────────────────────
//
// Itens soltos que se ligam e desligam um a um (restrições, emojis, funis), mais
// as etiquetas PRÓPRIAS (o que a pessoa escreveu), que só se tiram, e um campo de
// adicionar. `aria-pressed` porque cada uma é independente (não é escolha única).
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

export interface EtiquetasDeEscolhaProps {
  rotulo: string;
  opcoes: { valor: string; rotulo: string; nome?: string }[];
  escolhidas: string[];
  aoMudar: (escolhidas: string[]) => void;
  proprias?: string[];
  aoTirarPropria?: (texto: string) => void;
  adicionar?: { rotulo: string; placeholder: string; aoAdicionar: (texto: string) => void; maxLength?: number };
  /** Etiqueta grande (emoji). */
  grande?: boolean;
}

const CLASSE = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function EtiquetasDeEscolha({
  rotulo, opcoes, escolhidas, aoMudar, proprias = [], aoTirarPropria, adicionar, grande = false,
}: EtiquetasDeEscolhaProps) {
  const [texto, setTexto] = useState('');
  const existentes = new Set([...opcoes.map((o) => o.rotulo), ...proprias].map((t) => t.trim().toLowerCase()));
  const limpo = texto.trim();
  const podeAdicionar = !!limpo && !existentes.has(limpo.toLowerCase());

  const trocar = (valor: string) =>
    aoMudar(escolhidas.includes(valor) ? escolhidas.filter((v) => v !== valor) : [...escolhidas, valor]);
  const confirmar = () => {
    if (!adicionar || !podeAdicionar) return;
    adicionar.aoAdicionar(limpo);
    setTexto('');
  };

  return (
    <div className="space-y-3">
      <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const on = escolhidas.includes(o.valor);
          return (
            <button key={o.valor} type="button" aria-pressed={on} aria-label={o.nome} onClick={() => trocar(o.valor)}
              className={cn(CLASSE, grande && 'text-lg', on ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
              {o.rotulo}
            </button>
          );
        })}
        {proprias.map((p) => (
          <span key={p} className={cn(CLASSE, 'border-primary bg-primary/5 text-primary')}>
            {p}
            {aoTirarPropria && (
              <button type="button" aria-label={`Tirar ${p}`} onClick={() => aoTirarPropria(p)}
                className="-mr-1 rounded-full p-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </span>
        ))}
      </div>
      {adicionar && (
        <div className="flex flex-wrap gap-2">
          <Input aria-label={adicionar.rotulo} placeholder={adicionar.placeholder} value={texto} maxLength={adicionar.maxLength ?? 120}
            onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }}
            className="h-11 min-w-[12rem] flex-1 text-base md:text-base" />
          <Button type="button" variant="outline" className="h-11" disabled={!podeAdicionar} onClick={confirmar}>Adicionar</Button>
        </div>
      )}
    </div>
  );
}
