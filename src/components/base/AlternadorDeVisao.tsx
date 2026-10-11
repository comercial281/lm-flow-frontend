// ── ALTERNADOR DE VISÃO ──────────────────────────────────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 19): só
// ícones, colados num contorno, o selecionado em roxo ("mais clean" que o
// segmentado com texto). Troca o JEITO de ver a mesma coisa (cartões, lista,
// mapa, calendário, quadro). Período (Mês/Semana/Dia) e filtro não são visão:
// esses são `BotoesDeEscolha`.
//
// Substitui os pares de `Button` default/ghost montados à mão em cada tela
// (Funis, Canais, Times, Usuários, Imóveis, Visitas, quadro do funil). A trava
// `alternadorAMao` do `conferir-padrao` impede que voltem.
//
// Ícones da casa: `Grid3X3` cartões, `List` lista, `Map` mapa, `CalendarDays`
// calendário, `Kanban` quadro.
//
// O roxo do selecionado vem por `aria-pressed:bg-primary`, e não por
// `bg-primary` direto: a regra global `button.bg-primary` (globals.css) pinta o
// degradê e a sombra do botão principal, e alternador selecionado não ganha
// degradê (GLOSSARIO, peça 14).
//
// Teclado como o `BotoesDeEscolha`: só o selecionado entra no Tab, as setas
// esquerda/direita andam e escolhem (dando a volta).
import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcaoDeVisao<T extends string> {
  valor: T;
  icone: LucideIcon;
  /** O efeito, pro leitor de tela e pra dica do mouse: "Ver em lista". */
  nome: string;
}

export interface AlternadorDeVisaoProps<T extends string> {
  /** Nome do grupo pro leitor de tela ("Visão"). */
  rotulo?: string;
  valor: T;
  opcoes: OpcaoDeVisao<T>[];
  aoEscolher: (valor: T) => void;
  className?: string;
}

export default function AlternadorDeVisao<T extends string>({
  rotulo = 'Visão', valor, opcoes, aoEscolher, className,
}: AlternadorDeVisaoProps<T>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const comFoco = Math.max(0, opcoes.findIndex((o) => o.valor === valor));

  const escolher = (i: number) => {
    if (opcoes[i].valor !== valor) aoEscolher(opcoes[i].valor);
  };

  const teclar = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const j = (i + passo + opcoes.length) % opcoes.length;
    botoes.current[j]?.focus();
    escolher(j);
  };

  return (
    <div role="group" aria-label={rotulo} className={cn('inline-flex shrink-0 items-center overflow-hidden rounded-lg border', className)}>
      {opcoes.map(({ valor: v, icone: Icone, nome }, i) => {
        const on = v === valor;
        return (
          <button
            key={v}
            ref={(el) => { botoes.current[i] = el; }}
            type="button"
            aria-pressed={on}
            aria-label={nome}
            title={nome}
            tabIndex={i === comFoco ? 0 : -1}
            onClick={() => escolher(i)}
            onKeyDown={(e) => teclar(e, i)}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center transition-colors sm:h-8 sm:w-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              'aria-pressed:bg-primary aria-pressed:text-primary-foreground',
              !on && 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icone className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
