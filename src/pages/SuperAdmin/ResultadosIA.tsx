import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { CalendarCheck, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import { COLOR_VISITS, int, pct } from '@/components/salesAgents/aiResultsFormat';
import { superAgentsService } from '@/services/superAdmin/superAgentsService';
import type {
  PerformanceCounts, PerformancePoint, PerformanceReport, PerformanceTenant,
} from '@/types/aiResults';

// Resultados da IA — a tela que o dono abre NA FRENTE do cliente.
//
// O Custo da IA responde "quanto gastei". Esta responde a pergunta que a
// imobiliária faz: "isso está funcionando?". Por isso nenhum token e nenhum dólar
// aparecem aqui — o que convence é lead atendido, lead que respondeu e visita
// marcada. O custo continua na tela dele, que é onde ele importa.
//
// O painel em si é compartilhado com a aba Resultados que o cliente vê dentro do
// CRM dele: mesma medição no servidor e mesma apresentação aqui, pra não existir
// um número na tela dele e outro na nossa. O que esta tela acrescenta é o que só
// faz sentido pra quem olha vários clientes: o seletor e a lista por cliente.

const ALL = '__todos__';

const PERIODS: [number, string][] = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];

export default function ResultadosIA() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [days, setDays] = useState(30);
  const [client, setClient] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await superAgentsService.performance(days));
    } catch {
      toast.error('Não consegui carregar os resultados da IA.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo<PerformanceTenant | null>(() => {
    if (client === ALL || !report) return null;
    return report.tenants.find((t) => tenantKey(t) === client) ?? null;
  }, [client, report]);

  // Um cliente escolhido manda em TUDO: números, gráficos e tabela. Sem isso a
  // tela mostraria o total da plataforma ao lado do nome de um cliente só.
  const counts: PerformanceCounts | null = selected ?? report?.totals ?? null;
  const series: PerformancePoint[] = selected?.series ?? report?.series ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Resultados da IA
        </h1>
        <p className="text-sm text-muted-foreground">
          O que a IA Vendedora produziu no período: quem ela atendeu, quantos responderam e quantas
          visitas ela marcou sozinha. Feita para mostrar ao cliente.
        </p>
      </div>

      {/* Uma linha de filtros acima de tudo que eles recortam — e não um filtro
          dentro de cada cartão, que faria dois blocos vizinhos mostrarem períodos
          diferentes sem avisar. */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-1">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                days === value
                  ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                  : 'border-sidebar-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {report && report.tenants.length > 0 && (
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm border border-sidebar-border bg-background max-w-[16rem]"
          >
            <option value={ALL}>Todos os clientes ({report.tenants.length})</option>
            {report.tenants.map((t) => (
              <option key={tenantKey(t)} value={tenantKey(t)}>{t.tenant_name}</option>
            ))}
          </select>
        )}

        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && !report ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : !report || !counts || report.tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma IA com movimento no período. Os números aparecem conforme as IAs atendem.
        </p>
      ) : (
        // Recarregar segura o desenho anterior mais apagado em vez de piscar um
        // esqueleto: trocar de período na frente do cliente não pode fazer a tela
        // sumir e voltar.
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <AiResultsPanel
            counts={counts}
            series={series}
            caption={`Leads atendidos pela IA em ${selected?.tenant_name ?? 'todos os clientes'}`}
            seriesTitle={`Dia a dia ${selected ? `· ${selected.tenant_name}` : '· todos os clientes'}`}
          />

          {!selected && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold mb-3">Por cliente</h2>
              <div className="space-y-1">
                {report.tenants.map((tenant) => (
                  <button
                    key={tenantKey(tenant)}
                    type="button"
                    onClick={() => setClient(tenantKey(tenant))}
                    className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left rounded-md border border-sidebar-border hover:bg-muted/40"
                  >
                    <span className="text-sm font-medium flex-1 min-w-[8rem] truncate">{tenant.tenant_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {int(tenant.ai_leads)} atendidos
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap w-24 text-right">
                      {pct(tenant.reply_rate)} resposta
                    </span>
                    {/* O selo que o dono pediu: a visita marcada pela IA é o que
                        ele quer ver de relance ao lado do nome do cliente. Some
                        quando é zero — selo zerado num cliente novo tira o
                        destaque justamente de quem tem o número pra mostrar. */}
                    {tenant.visits > 0 && (
                      <span
                        className="text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap flex items-center gap-1"
                        style={{ color: COLOR_VISITS, backgroundColor: `${COLOR_VISITS}1a` }}
                      >
                        <CalendarCheck className="h-3 w-3" />
                        {tenant.visits} {tenant.visits === 1 ? 'visita pela IA' : 'visitas pela IA'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            Período: últimos {report.days} dias. Uma visita conta como “da IA” quando foi a própria IA
            que a marcou dentro da conversa.
          </p>
        </div>
      )}
    </div>
  );
}

function tenantKey(tenant: PerformanceTenant): string {
  return tenant.tenant_slug ?? 'raiz';
}
