// src/features/cardDoLead/blocos/CaixaDoCard.tsx
// A caixa de borda dos blocos do card (a mesma da aba Detalhes da janela).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function CaixaDoCard({ titulo, acao, className, children }: {
  titulo: string;
  /** Botão no canto do título (ex.: o lápis de corrigir telefone/e-mail). */
  acao?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const cabeca = <h4 className="text-sm font-semibold">{titulo}</h4>;
  return (
    <div className={cn('rounded-xl border border-border p-4 space-y-3', className)}>
      {acao ? <div className="flex items-center justify-between gap-2">{cabeca}{acao}</div> : cabeca}
      {children}
    </div>
  );
}
