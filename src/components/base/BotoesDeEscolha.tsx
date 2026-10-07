// ── BOTÕES DE ESCOLHA (segmentado) ───────────────────────────────────────────
//
// Uma escolha entre 2 e 5 opções curtas, lado a lado (decisão 3 do Tony na
// reestruturação da IA, 06/10/2026: "controles funcionais, não lista"). Opção que
// precisa de frase de explicação é CartoesDeEscolha; lista comprida é o Seletor.
//
// Acessível como grupo de rádio: só a marcada entra no Tab, as setas andam e
// escolhem (como o rádio nativo), a desabilitada fica fora das setas e diz o
// motivo no `title`. `aoEscolher` pode gravar na hora: quem chama decide.
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { proximaHabilitada, type OpcaoDeEscolha } from './escolha';

export interface BotoesDeEscolhaProps<T extends string> {
  /** O nome do grupo pro leitor de tela ("Horário", "Modo"). */
  rotulo: string;
  /** Null = nenhuma marcada (valor antigo que não está nas opções). */
  valor: T | null;
  opcoes: OpcaoDeEscolha<T>[];
  aoEscolher: (valor: T) => void;
  desabilitado?: boolean;
  className?: string;
}

export default function BotoesDeEscolha<T extends string>({
  rotulo, valor, opcoes, aoEscolher, desabilitado = false, className,
}: BotoesDeEscolhaProps<T>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const marcada = opcoes.findIndex((o) => o.valor === valor);
  const comFoco = marcada >= 0 ? marcada : opcoes.findIndex((o) => !o.desabilitada);

  const escolher = (i: number) => {
    const o = opcoes[i];
    if (desabilitado || o.desabilitada || o.valor === valor) return;
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
    <div role="radiogroup" aria-label={rotulo} aria-disabled={desabilitado || undefined}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1', className)}>
      {opcoes.map((o, i) => {
        const on = o.valor === valor;
        return (
          <button key={o.valor} ref={(el) => { botoes.current[i] = el; }} type="button" role="radio"
            aria-checked={on} aria-disabled={o.desabilitada || desabilitado || undefined}
            tabIndex={i === comFoco ? 0 : -1} title={o.desabilitada ? o.motivo : undefined}
            onClick={() => escolher(i)} onKeyDown={(e) => teclar(e, i)}
            className={cn(
              'min-h-10 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on && 'bg-background font-semibold text-primary shadow-sm',
              !on && !o.desabilitada && 'hover:text-foreground',
              (o.desabilitada || desabilitado) && 'cursor-not-allowed opacity-50',
            )}>
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
