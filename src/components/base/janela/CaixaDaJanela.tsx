// Caixa do miolo: 14 px dentro, título e contagem parados, corpo rola por dentro.
// Caixas lado a lado ganham a mesma altura pelo pai (grid com altura fixa).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function CaixaDaJanela({ titulo, contagem, acao, fixo, className, corpoClassName, children, ...resto }: { titulo: string; contagem?: number; acao?: ReactNode; fixo?: ReactNode; className?: string; corpoClassName?: string; children: ReactNode; 'data-testid'?: string }) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background', className)} data-testid={resto['data-testid']}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-3.5 pt-3.5 pb-2">
        <h4 className="text-sm font-semibold">{titulo}{contagem != null && <span className="font-normal text-muted-foreground"> · {contagem}</span>}</h4>
        {acao}
      </div>
      {fixo && <div className="shrink-0 px-3.5 pb-2">{fixo}</div>}
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5', corpoClassName)}>{children}</div>
    </section>
  );
}
