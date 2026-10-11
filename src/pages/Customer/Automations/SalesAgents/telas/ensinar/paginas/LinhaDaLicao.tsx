import type { SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';
import { cn } from '@/lib/utils';
import { VAZIO, dataCurta as dataCurtaDaCasa } from '@/lib/formato';

/** dd/mm pelo módulo de formato da casa (vazio, sem travessão, se a data não for válida: fica ao lado do selo). */
export const dataCurta = (iso: string) => {
  const d = dataCurtaDaCasa(iso);
  return d === VAZIO ? '' : d;
};

/** "Sugestão aceita" ou "Escrita à mão" (o servidor não guarda quem escreveu). */
export function SeloDeOrigem({ licao, className }: { licao: SalesAgentLesson; className?: string }) {
  const sugestao = licao.origin === 'suggestion';
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
      sugestao ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground/80', className)}>
      {sugestao ? 'Sugestão aceita' : 'Escrita à mão'}
    </span>
  );
}
