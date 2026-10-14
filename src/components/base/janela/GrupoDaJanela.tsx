// Grupo do miolo da janela (glossário item 23): título pequeno em caixa alta e
// os campos embaixo. Espaço curto dentro do grupo; o espaço maior fica entre grupos.
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function GrupoDaJanela({ titulo, acao, className, children }: { titulo: string; acao?: ReactNode; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn('grid gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p id={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
        {acao}
      </div>
      {children}
    </div>
  );
}
