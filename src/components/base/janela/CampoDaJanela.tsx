// Campo do miolo da janela (glossário item 23): rótulo médio e apagado, o campo
// embaixo, ajuda e erro pequenos. `colunas` diz quantas das 4 colunas da grade ele ocupa.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const COLUNAS = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
} as const;

export default function CampoDaJanela({ rotulo, htmlFor, idDoRotulo, obrigatorio, ajuda, erro, colunas = 1, className, children }: {
  rotulo: string;
  htmlFor?: string;
  /** Id do rótulo, pra um grupo de botões ligar o `aria-labelledby` a ele. */
  idDoRotulo?: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  colunas?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid content-start gap-1.5 text-sm', COLUNAS[colunas], className)}>
      <label id={idDoRotulo} htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/80">
        {rotulo}
        {obrigatorio && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </label>
      {children}
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
