import type { SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';
import { cn } from '@/lib/utils';
import { ROTULO_DA_ORIGEM } from '../paginas';
import { VAZIO, dataCurta as dataCurtaDaCasa } from '@/lib/formato';

/** dd/mm pelo módulo de formato da casa (vazio, sem travessão, se a data não for válida: fica ao lado do selo). */
export const dataCurta = (iso: string) => {
  const d = dataCurtaDaCasa(iso);
  return d === VAZIO ? '' : d;
};

/** Quem escreveu: sugestão aceita, correção de uma conversa ou a equipe (cada origem tem o selo dela). */
export function SeloDeOrigem({ licao, className }: { licao: SalesAgentLesson; className?: string }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
      licao.origin === 'equipe' ? 'bg-muted text-foreground/80' : 'bg-primary/10 text-primary', className)}>
      {ROTULO_DA_ORIGEM[licao.origin] ?? ROTULO_DA_ORIGEM.equipe}
    </span>
  );
}
