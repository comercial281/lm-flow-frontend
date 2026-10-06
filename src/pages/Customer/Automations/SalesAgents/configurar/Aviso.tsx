import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Aviso({ tom = 'ambar', children }: { tom?: 'ambar' | 'vermelho' | 'neutro'; children: ReactNode }) {
  const cor = tom === 'vermelho'
    ? 'border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400'
    : tom === 'ambar' ? 'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-400' : 'border-border bg-muted/40 text-muted-foreground';
  return <div className={cn('rounded-md border p-3 text-sm', cor)}>{children}</div>;
}
