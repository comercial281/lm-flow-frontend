// Título de seção dos painéis de filtro (Conversas e Contatos): pequeno, em caixa alta, apagado.
// Com `htmlFor` vira rótulo do campo logo abaixo; sem ele, é só um título.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const CLASSE = 'mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground';

export default function TituloDoFiltro({ children, htmlFor, className }: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  if (htmlFor) {
    return <label htmlFor={htmlFor} className={cn('block', CLASSE, className)}>{children}</label>;
  }
  return <p className={cn(CLASSE, className)}>{children}</p>;
}
