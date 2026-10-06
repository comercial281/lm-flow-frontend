import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Layout "explicação ao lado" (decisão L1 do Meu site, 04/10/2026). Desde a
// entrega 2 da IA Vendedora (05/10) é peça da casa: o Meu site e o passo a passo
// da IA usam a mesma faixa (título + frase à esquerda, campos à direita).
//
// Cada bloco de configuração é uma FAIXA da largura toda: à esquerda (≈ 1/3, de
// `lg` pra cima) o título e uma frase dizendo pra que serve e onde aparece no
// site; à direita, os campos. Abaixo de `lg` empilha: título em cima, campos
// embaixo. As faixas de uma tela moram numa caixa só (`Secoes`), separadas por
// divisória — caixa com borda por bloco fazia a tela virar uma pilha de cartões.

/** A caixa única de uma tela do Meu site. As `Secao` dentro dela ganham divisória. */
export function Secoes({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('divide-y divide-border rounded-xl border border-border bg-card px-5 sm:px-8', className)}>
      {children}
    </div>
  );
}

interface SecaoProps {
  titulo: string;
  /** Uma frase do dia a dia: o que é e onde aparece no site. */
  descricao?: ReactNode;
  /** Algo que acompanha o título (ex.: a chave que liga a página). Fica embaixo da frase. */
  acao?: ReactNode;
  id?: string;
  children?: ReactNode;
}

export function Secao({ titulo, descricao, acao, id, children }: SecaoProps) {
  return (
    <section id={id} className="grid gap-x-12 gap-y-5 py-8 lg:grid-cols-3">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {descricao && <div className="text-sm leading-relaxed text-muted-foreground">{descricao}</div>}
        {acao && <div className="pt-2">{acao}</div>}
      </div>
      {children && <div className="min-w-0 space-y-5 lg:col-span-2">{children}</div>}
    </section>
  );
}
