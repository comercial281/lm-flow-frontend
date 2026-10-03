// src/pages/Customer/Properties/lista/SeloSituacao.tsx
import type { Tom } from '@/features/properties/listingKind';

export const TONS: Record<Tom, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  alerta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  neutro: 'bg-muted text-muted-foreground',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  marca: 'bg-primary/10 text-primary',
};

export default function Selo({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${TONS[tom]}`}>{children}</span>;
}

export const TOM_DA_FASE: Record<string, Tom> = { pre_launch: 'info', launch: 'marca', in_construction: 'alerta', ready: 'ok' };
