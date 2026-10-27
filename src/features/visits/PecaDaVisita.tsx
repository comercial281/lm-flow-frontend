import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { Bot, Check, User } from 'lucide-react';
import { hora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS, type Visit } from '@/services/visits/visitsService';
import { quemAgendou } from './quemAgendou';
import { ehAtrasada, estiloDaSituacao } from './situacaoDaVisita';

export function IconeDeQuemAgendou({
  visita,
  className,
}: {
  visita: Pick<Visit, 'booked_by' | 'created_by'>;
  className?: string;
}) {
  const q = quemAgendou(visita);
  if (!q) return null;
  const Icone = q.tipo === 'ia' ? Bot : User;
  return <Icone role="img" aria-label={q.rotulo} className={cn('shrink-0', className)} />;
}

function nomeDaVisita(v: Visit): string {
  return v.contact?.name || v.property?.title || 'Visita';
}

// "Maria Souza Lima" -> "Maria S." (cabe na pílula do mês).
function nomeCurto(nome: string): string {
  const [primeiro, segundo] = nome.trim().split(/\s+/);
  return segundo ? `${primeiro} ${segundo[0].toUpperCase()}.` : primeiro;
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  visita: Visit;
  forma: 'pilula' | 'bloco';
  /** Altura do bloco em px (esconde o imóvel quando baixo). */
  altura?: number;
  destacada?: boolean;
  /** Duração em minutos, só pro "hora–fim" do bloco. */
  duracaoMin?: number;
  onClick: (v: Visit) => void;
};

export const PecaDaVisita = forwardRef<HTMLButtonElement, Props>(function PecaDaVisita(
  { visita, forma, altura, destacada, duracaoMin, onClick, className, style, ...handlersDaPrevia },
  ref,
) {
  const inicio = new Date(visita.scheduled_at);
  const nome = nomeDaVisita(visita);
  const situacao = VISIT_STATUS_LABELS[visita.status] ?? visita.status;
  const h = hora(inicio);
  const atrasada = ehAtrasada(visita);
  const riscado = visita.status === 'cancelled';
  const q = quemAgendou(visita);
  const icone = q ? (
    <span title={q.rotulo} className="inline-flex shrink-0">
      <IconeDeQuemAgendou visita={visita} className={forma === 'pilula' ? 'h-[11px] w-[11px]' : 'h-3 w-3'} />
    </span>
  ) : null;
  const base: CSSProperties = { ...estiloDaSituacao(visita.status), ...style };

  const comum = {
    ref,
    id: `visita-${visita.id}`,
    type: 'button' as const,
    'data-visit': visita.id,
    'data-s': visita.status,
    'aria-label': `${h} · ${nome} · ${situacao}`,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onClick(visita); },
    style: base,
    ...handlersDaPrevia,
  };

  if (forma === 'pilula') {
    return (
      <button
        {...comum}
        className={cn(
          'relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md border-l-[3px] border-l-[var(--st)] bg-muted px-1.5 py-[3px] text-left text-[11px] transition-colors hover:bg-muted/70',
          (visita.status === 'cancelled' || visita.status === 'completed') && 'opacity-80',
          destacada && 'ring-2 ring-primary',
          className,
        )}
      >
        <span className="shrink-0 font-medium tabular-nums text-muted-foreground">{h}</span>
        {visita.status === 'completed' && <Check aria-hidden className="h-[11px] w-[11px] shrink-0" style={{ color: 'var(--visita-confirmed)' }} />}
        {icone}
        <span className={cn('min-w-0 truncate font-semibold', riscado && 'text-muted-foreground line-through')}>{nomeCurto(nome)}</span>
        {atrasada && (
          <span
            title="Passou e ninguém registrou"
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--visita-atrasada)' }}
          />
        )}
      </button>
    );
  }

  const fim = duracaoMin ? hora(new Date(inicio.getTime() + duracaoMin * 60000)) : null;
  const alta = (altura ?? 0) >= 46;
  return (
    <button
      {...comum}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md border-l-[3px] border-l-[var(--st)] px-[7px] py-1 text-left text-foreground transition-colors',
        'bg-[color-mix(in_oklch,var(--st)_15%,var(--card))] hover:bg-[color-mix(in_oklch,var(--st)_24%,var(--card))]',
        destacada && 'ring-2 ring-primary',
        className,
      )}
    >
      <span className="flex items-center gap-1 text-[10.5px] font-medium tabular-nums text-muted-foreground">
        {fim ? `${h}–${fim}` : h}
        {atrasada && (
          <span
            title="Passou e ninguém registrou"
            className="ml-auto h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--visita-atrasada)' }}
          />
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
        {icone}
        <span className={cn('truncate', riscado && 'text-muted-foreground line-through')}>{nome}</span>
      </span>
      {alta && visita.property?.title && (
        <span className="block truncate text-[11px] text-muted-foreground">{visita.property.title}</span>
      )}
    </button>
  );
});
