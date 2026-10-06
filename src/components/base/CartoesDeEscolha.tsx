// ── CARTÕES DE ESCOLHA ───────────────────────────────────────────────────────
//
// Uma escolha entre opções que precisam de explicação (persona, objetivo, quando
// ela passa, destino). Mesmo contrato e mesma acessibilidade dos BotoesDeEscolha
// (grupo de rádio, setas, desabilitada fora das setas); a frase é a descrição
// acessível do cartão, e na desabilitada o motivo toma o lugar da frase.
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { proximaHabilitada, type OpcaoDeEscolha } from './BotoesDeEscolha';

export interface CartoesDeEscolhaProps<T extends string> {
  rotulo: string;
  valor: T | null;
  opcoes: OpcaoDeEscolha<T>[];
  aoEscolher: (valor: T) => void;
  /** 2 (padrão) ou 3 colunas; empilha abaixo de `md`. */
  colunas?: 2 | 3;
  /**
   * Um botão AO LADO de cada cartão (ex.: "Ouvir" a voz). Fica fora do cartão de
   * propósito: botão dentro de botão não existe, e o leitor de tela leria os dois juntos.
   */
  acessorio?: (opcao: OpcaoDeEscolha<T>) => ReactNode;
}

export default function CartoesDeEscolha<T extends string>({ rotulo, valor, opcoes, aoEscolher, colunas = 2, acessorio }: CartoesDeEscolhaProps<T>) {
  const base = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const marcada = opcoes.findIndex((o) => o.valor === valor);
  const comFoco = marcada >= 0 ? marcada : opcoes.findIndex((o) => !o.desabilitada);

  const escolher = (i: number) => {
    const o = opcoes[i];
    if (o.desabilitada || o.valor === valor) return;
    aoEscolher(o.valor);
  };
  const teclar = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const j = proximaHabilitada(opcoes, i, passo);
    botoes.current[j]?.focus();
    escolher(j);
  };

  return (
    <div role="radiogroup" aria-label={rotulo}
      className={cn('grid gap-2.5', colunas === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
      {opcoes.map((o, i) => {
        const on = o.valor === valor;
        const frase = o.desabilitada && o.motivo ? o.motivo : o.descricao;
        const idFrase = `${base}-${i}`;
        const cartao = (
          <button ref={(el) => { botoes.current[i] = el; }} type="button" role="radio"
            // O nome é só o título; a frase é a descrição (senão o leitor lê os dois como nome).
            aria-checked={on} aria-disabled={o.desabilitada || undefined} aria-labelledby={`${idFrase}-t`} aria-describedby={frase ? idFrase : undefined}
            tabIndex={i === comFoco ? 0 : -1} onClick={() => escolher(i)} onKeyDown={(e) => teclar(e, i)}
            className={cn(
              'flex flex-1 flex-col gap-1 rounded-2xl border-[1.5px] bg-background px-4 py-3.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary bg-primary/5 ring-[3px] ring-primary/15' : 'border-border hover:border-primary/40',
              o.desabilitada && 'cursor-not-allowed opacity-50',
            )}>
            <span id={`${idFrase}-t`} className="text-sm font-semibold text-foreground">{o.rotulo}</span>
            {frase && <span id={idFrase} className="text-[13px] leading-snug text-muted-foreground">{frase}</span>}
          </button>
        );
        return (
          <div key={o.valor} className="flex items-stretch gap-2">
            {cartao}
            {acessorio?.(o)}
          </div>
        );
      })}
    </div>
  );
}
