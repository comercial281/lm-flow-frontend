import { Button } from '@/components/ui/ds';
import { dolar, porcentagem } from '@/lib/formato';
import type { Reconciliation } from '@/types/admin/costs';

// O registro bate com a fatura? Em US$, porque a fatura vem em dólar.
export default function Conferencia({ reconciliation, aoLancar }: { reconciliation: Reconciliation[]; aoLancar: () => void }) {
  if (reconciliation.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Conferência com a fatura</h3>
        <Button variant="outline" size="sm" onClick={aoLancar}>Lançar faturas do mês</Button>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {reconciliation.map((r) => (
          <li key={r.provider} className="flex flex-wrap justify-between gap-2">
            <span>{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              Registrado {dolar(r.recorded_usd)}
              {r.invoice_usd == null
                ? ' · Fatura ainda não lançada'
                : ` · Fatura ${dolar(r.invoice_usd)} · diferença ${porcentagem(r.diff_pct ?? 0, 1)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
