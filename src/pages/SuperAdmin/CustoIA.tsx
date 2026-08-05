import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, DollarSign, Loader2, RefreshCw } from 'lucide-react';

import {
  superAgentsService,
  type CostReport,
  type CostTotals,
} from '@/services/superAdmin/superAgentsService';

// Custo da IA por cliente.
//
// Uma ÚNICA ANTHROPIC_API_KEY paga o consumo de TODOS os tenants: não havia teto
// por cliente, contador nem alerta. Um cliente com muito volume (ou base de
// conhecimento enorme) encarecia a conta de todo mundo em silêncio, e a fatura
// chegava no fim do mês sem dono. Esta tela dá dono ao gasto.
//
// Os números vêm de sales_agent_runs, gravado a cada turno da IA — inclusive os
// turnos que não geraram resposta, que também custam quando o modelo foi chamado.

const PERIODS: [number, string][] = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];

export default function CustoIA() {
  const [report, setReport] = useState<CostReport | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await superAgentsService.costs(days));
    } catch {
      toast.error('Não consegui carregar o gasto.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Custo da IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Quanto cada cliente consumiu de IA no período. A chave da Anthropic é uma só para todos, então este é o rateio real.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex gap-1 my-4">
        {PERIODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDays(value)}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              days === value ? 'bg-primary/10 text-primary border-primary/40' : 'border-sidebar-border text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !report ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : !report || report.tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum consumo registrado no período. Os números começam a aparecer conforme as IAs atendem.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <Card label="Total no período" value={money(report.totals.cost_usd)} highlight />
            <Card label="Atendimentos" value={report.totals.replied.toLocaleString('pt-BR')} />
            <Card label="Falhas" value={report.totals.failed.toLocaleString('pt-BR')} />
            <Card label="Custo médio" value={money(avgCost(report.totals))} />
          </div>

          <div className="space-y-1">
            {report.tenants.map((tenant) => {
              const key = tenant.tenant_slug ?? 'raiz';
              const open = expanded.has(key);
              return (
                <div key={key} className="rounded-md border border-sidebar-border">
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                  >
                    {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                    <span className="text-sm font-medium flex-1 truncate">{tenant.tenant_name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {tenant.replied} atend.
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap w-24 text-right">{money(tenant.cost_usd)}</span>
                  </button>

                  {open && (
                    <div className="border-t border-sidebar-border px-3 py-2 space-y-2">
                      {tenant.agents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum agente.</p>
                      ) : (
                        tenant.agents.map((agent) => (
                          <div key={agent.id} className="flex items-center gap-2 text-xs">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${agent.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                            <span className="flex-1 truncate">{agent.name}</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {agent.replied} ok · {agent.skipped} pulou · {agent.failed} falhou
                            </span>
                            <span className="w-20 text-right whitespace-nowrap">{money(agent.cost_usd)}</span>
                          </div>
                        ))
                      )}
                      <p className="text-xs text-muted-foreground pt-1 border-t border-sidebar-border">
                        {tenant.input_tokens.toLocaleString('pt-BR')} tokens de entrada ·{' '}
                        {tenant.output_tokens.toLocaleString('pt-BR')} de saída
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// 4 casas: um atendimento de WhatsApp custa fração de centavo de dólar, e
// arredondar pra 2 mostraria US$ 0,00 na linha de quase todo agente.
function money(value: number): string {
  return `US$ ${value.toFixed(value < 1 ? 4 : 2)}`;
}

function avgCost(totals: CostTotals): number {
  return totals.replied > 0 ? totals.cost_usd / totals.replied : 0;
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'border-primary/40 bg-primary/5' : 'border-sidebar-border'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
