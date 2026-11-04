import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Aviso from '@/components/base/Aviso';
import EmptyState from '@/components/base/EmptyState';
import { locacaoDesligada } from '@/features/locacao/locacaoService';
import type { Severidade } from '@/features/locacao/tipos';

export const TEXTO_DESLIGADA = 'A Locação não está ligada nesta conta';

const COR_DO_SELO: Record<Severidade, string> = {
  bad: 'bg-red-500/10 text-red-700 dark:text-red-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

/** O selinho colorido das listas (Em dia, Aluguel atrasado…). */
export function Selo({ sev, children, className }: { sev: Severidade; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', COR_DO_SELO[sev], className)}>
      {children}
    </span>
  );
}

/** Um número grande com o nome embaixo (Painel e fichas). */
export function Numero({ rotulo, valor, ajuda, tom }: { rotulo: string; valor: ReactNode; ajuda?: ReactNode; tom?: Severidade }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className={cn('text-xl font-semibold tabular-nums', tom === 'bad' && 'text-red-600 dark:text-red-400')}>{valor}</span>
      {ajuda && <span className="text-xs text-muted-foreground">{ajuda}</span>}
    </div>
  );
}

/** Linha "nome ... valor" das fichas. */
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium tabular-nums">{children}</span>
    </div>
  );
}

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {acao}
    </div>
  );
}

/** Falha de carga: Locação desligada vira aviso claro; o resto, "tentar de novo". */
export function Falha({ erro, aoTentar }: { erro: unknown; aoTentar: () => void }) {
  if (locacaoDesligada(erro)) {
    return (
      <Aviso tom="info" titulo={TEXTO_DESLIGADA}>
        Peça a quem cuida da conta para ligar este módulo.
      </Aviso>
    );
  }
  return <EmptyState tipo="erro" aoTentarDeNovo={aoTentar} />;
}
