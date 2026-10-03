import EmptyState from '@/components/base/EmptyState';
import { dinheiro, porcentagem } from '@/lib/formato';

export interface ItemEmBarra { chave: string; rotulo: string; valor: number; parte: number; detalhe?: string }

export default function ListaEmBarras({ titulo, itens, vazio }: { titulo: string; itens: ItemEmBarra[]; vazio: string }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      {itens.length === 0 ? (
        <EmptyState tipo="vazio" title={vazio} />
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((i) => (
            <li key={i.chave} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{i.rotulo}</span>
                <span className="shrink-0 tabular-nums">
                  {dinheiro(i.valor)} <span className="text-muted-foreground">{porcentagem(i.parte * 100, 0)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, i.parte * 100))}%` }} />
              </div>
              {i.detalhe && <span className="text-xs text-muted-foreground">{i.detalhe}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
