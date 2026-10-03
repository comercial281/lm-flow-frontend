import BarChartCard from '@/components/charts/BarChartCard';
import EmptyState from '@/components/base/EmptyState';
import { dataCurta, dinheiro, numero, plural } from '@/lib/formato';
import type { CostsSummary } from '@/types/admin/costs';
import ListaEmBarras from './ListaEmBarras';

const VAZIO = 'Nenhuma chamada de IA neste mês';

export default function Recortes({ summary }: { summary: CostsSummary }) {
  const chamadas = (n: number) => `${numero(n)} ${plural(n, 'chamada', 'chamadas')}`;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ListaEmBarras titulo="Por função" vazio={VAZIO}
        itens={summary.by_feature.map((f) => ({ chave: f.key, rotulo: f.label, valor: f.brl, parte: f.share, detalhe: chamadas(f.calls) }))} />
      {!summary.tenant && (
        <ListaEmBarras titulo="Por cliente" vazio={VAZIO}
          itens={summary.by_tenant.map((t) => ({ chave: t.schema, rotulo: t.name, valor: t.brl, parte: t.share, detalhe: chamadas(t.calls) }))} />
      )}
      <ListaEmBarras titulo="Por modelo" vazio={VAZIO}
        itens={summary.by_model.map((m) => ({ chave: m.key, rotulo: m.label, valor: m.brl, parte: m.share, detalhe: chamadas(m.calls) }))} />
      {summary.totals.calls === 0 ? (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Gasto de IA dia a dia</h3>
          <EmptyState tipo="vazio" title={VAZIO} />
        </section>
      ) : (
        <BarChartCard title="Gasto de IA dia a dia" highlightMax={false}
          data={summary.daily.map((d) => ({ name: dataCurta(d.day), value: d.brl }))}
          valueFormatter={(v: number) => dinheiro(v)} />
      )}
    </div>
  );
}
