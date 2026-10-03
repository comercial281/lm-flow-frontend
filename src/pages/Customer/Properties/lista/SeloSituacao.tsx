// src/pages/Customer/Properties/lista/SeloSituacao.tsx
import { TONS, type Tom } from '@/features/properties/listingKind';

export default function Selo({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${TONS[tom]}`}>{children}</span>;
}

export const TOM_DA_FASE: Record<string, Tom> = { pre_launch: 'info', launch: 'marca', in_construction: 'alerta', ready: 'ok' };
