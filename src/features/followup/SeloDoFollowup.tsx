// Selo do follow-up no card do quadro (Follow-up não morre calado, 20/10/2026).
// O estado vem do servidor (`item.followup`), nunca de etiqueta. Sem follow-up
// (`null`) ou payload guardado de antes (`undefined`): não desenha nada.
import { cn } from '@/lib/utils';
import type { FollowupDoCard } from '@/types/analytics';

const COR = {
  active: 'bg-primary/10 text-primary',
  paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
} as const;

interface SeloDoFollowupProps {
  followup: FollowupDoCard | null | undefined;
  className?: string;
}

export default function SeloDoFollowup({ followup, className }: SeloDoFollowupProps) {
  if (!followup) return null;
  const pausado = followup.state === 'paused';
  return (
    <span
      data-followup={followup.state}
      title={(pausado ? followup.reason : followup.flow_name) || undefined}
      className={cn(
        'inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        COR[pausado ? 'paused' : 'active'],
        className,
      )}
    >
      {pausado ? 'Pausado' : 'Follow-up ativo'}
    </span>
  );
}
