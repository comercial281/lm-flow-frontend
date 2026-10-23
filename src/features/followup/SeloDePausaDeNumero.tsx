// Selo "Pausado" no card do quadro quando o fluxo parou porque o lead já
// conversa em outro número (Entrega 4). O estado vem do servidor
// (`item.number_pause`); sem pausa (null/undefined) não desenha nada.
import { cn } from '@/lib/utils';
import type { PausaDeNumeroDoCard } from '@/types/analytics';

export default function SeloDePausaDeNumero({ pausa, className }: { pausa: PausaDeNumeroDoCard | null | undefined; className?: string }) {
  if (!pausa) return null;
  return (
    <span
      data-pausa-de-numero
      title={`Já conversa em outro número: ${pausa.flow_name}`}
      className={cn(
        'inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      Pausado
    </span>
  );
}
