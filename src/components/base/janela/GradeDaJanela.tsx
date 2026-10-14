// Grade do miolo da janela (glossário item 23): 4 colunas no computador, 1 no celular.
// Cada CampoDaJanela ocupa 1, 2 ou 4 colunas e a borda direita fica alinhada.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function GradeDaJanela({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-4', className)}>{children}</div>;
}
