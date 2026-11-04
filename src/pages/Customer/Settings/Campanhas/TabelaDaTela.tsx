// Peças comuns das duas tabelas de Campanhas (Tarefa 8, 04/11/2026). De 1280 px pra cima é tabela (cabeçalho e colunas
// alinhadas); abaixo disso cada linha vira um cartão de uma coluna (duas no tablet), com o nome de cada campo em cima.
// Largura fixa em fração, com `minmax(0, ...)`: texto longo quebra dentro da coluna e nunca alarga a página.
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Card } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

export const GRADE_DOS_FORMULARIOS = 'xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,2fr)_5.5rem_4rem_4.5rem]';
export const GRADE_DOS_ANUNCIOS = 'xl:grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_minmax(0,2fr)_5.5rem_7rem_4.5rem]';

export function CabecalhoDaTabela({ grade, colunas }: { grade: string; colunas: string[] }) {
  return (
    <div className={cn('mb-2 hidden gap-4 px-5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground xl:grid', grade)} role="row">
      {colunas.map((c, i) => <span key={`${c}-${i}`} role="columnheader" className="min-w-0">{c}</span>)}
    </div>
  );
}

/** Um campo da linha. No cartão leva o nome em cima; na tabela o nome fica no cabeçalho. */
export function Celula({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)} role="cell">
      {rotulo && <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground xl:hidden">{rotulo}</span>}
      <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">{children}</div>
    </div>
  );
}

/** A linha inteira abre a janela (mouse); teclado e leitor de tela usam o botão Editar/Ver da própria linha. */
export function LinhaDaTabela({ grade, aoAbrir, testId, children }: { grade: string; aoAbrir: () => void; testId: string; children: ReactNode }) {
  const clicou = (e: MouseEvent<HTMLElement>) => {
    // Botão, chave e link dentro da linha fazem a ação deles e não abrem a janela.
    if ((e.target as HTMLElement).closest('button, a, input, [role=switch], [data-nao-abre]')) return;
    aoAbrir();
  };
  const tecla = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoAbrir(); }
  };
  return (
    <Card
      className="cursor-pointer gap-0 overflow-hidden py-0 transition-colors hover:bg-muted/30"
      data-testid={testId}
      role="row"
      tabIndex={0}
      onClick={clicou}
      onKeyDown={tecla}
    >
      <div className={cn('grid grid-cols-1 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 xl:items-center', grade)}>{children}</div>
    </Card>
  );
}

export function Tabela({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div role="table" aria-label={rotulo} className="min-w-0">{children}</div>;
}
