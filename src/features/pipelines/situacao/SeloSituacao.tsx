// Selo GANHO / PERDIDO do card (quadro, lista, janela e página). Card aberto
// não tem selo. `detalhe` (data e motivo, de detalheDaSituacao) vai ao passar
// o mouse. Assinatura `{ status }`: a Parte 4 (página do card) usa assim.
import { cn } from '@/lib/utils';
import type { PipelineItemStatus } from '@/types/analytics';
import { NOME_DA_SITUACAO } from './situacao';

const COR = {
  won: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  lost: 'bg-destructive/10 text-destructive',
} as const;

interface SeloSituacaoProps {
  status: PipelineItemStatus;
  /** Texto ao passar o mouse ("Perdido em 05/10/2026 · Adiou a compra"). */
  detalhe?: string | null;
  className?: string;
}

export default function SeloSituacao({ status, detalhe, className }: SeloSituacaoProps) {
  if (status === 'open') return null;
  const situacao = status;
  return (
    <span
      data-situacao={situacao}
      title={detalhe ?? undefined}
      className={cn(
        'inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        COR[situacao],
        className,
      )}
    >
      {NOME_DA_SITUACAO[situacao]}
    </span>
  );
}
