import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import { int, pct } from '@/components/salesAgents/aiResultsFormat';
import { superAgentsService } from '@/services/superAdmin/superAgentsService';
import type {
  PerformanceCounts, PerformancePoint, PerformanceReport, PerformanceTenant,
} from '@/types/aiResults';
import { ESQUELETO, PAGINA, SECAO, SELO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

// Resultados da IA — a tela que o dono abre NA FRENTE do cliente.
//
// A tela Custos responde "quanto gastei". Esta responde a pergunta que a
// imobiliária faz: "isso está funcionando?". Por isso nenhum token e nenhum dólar
// aparecem aqui — o que convence é lead atendido, lead que respondeu e visita
// marcada. O custo continua em Clientes → Custos, que é onde ele importa.
//
// O painel em si é compartilhado com a aba Resultados que o cliente vê dentro do
// CRM dele: mesma medição no servidor e mesma apresentação aqui, pra não existir
// um número na tela dele e outro na nossa. Ele NÃO é mexido daqui (a tela do
// cliente usa o mesmo). O que esta tela acrescenta é o que só faz sentido pra
// quem olha vários clientes: o seletor e a lista por cliente.

const ALL = '__todos__';

const PERIODOS = [
  { chave: '7', rotulo: '7 dias' },
  { chave: '30', rotulo: '30 dias' },
  { chave: '90', rotulo: '90 dias' },
];

export default function ResultadosIA() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [days, setDays] = useState(30);
  const [client, setClient] = useState<string>(ALL);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  // Só a última carga vale: trocar 7 → 90 → 30 rápido não deixa a do meio por cima.
  const seq = useRef(0);

  const load = useCallback(async () => {
    const minha = ++seq.current;
    setEstado('carregando');
    try {
      const r = await superAgentsService.performance(days);
      if (minha !== seq.current) return;
      setReport(r);
      setEstado('pronto');
    } catch {
      if (minha !== seq.current) return;
      setEstado('erro');
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
  const carregando = estado === 'carregando';

  return (
    <div className={`mx-auto max-w-6xl p-6 ${PAGINA}`}>
      <div>
        <h2 className={TITULO_SECAO}>Resultados da IA</h2>
        <p className={SUBTITULO_SECAO}>
          O que a IA Vendedora produziu no período: quem ela atendeu, quantos responderam e quantas
          visitas ela marcou sozinha. Feita para mostrar ao cliente.
        </p>
      </div>

      {/* Uma linha de filtros acima de tudo que eles recortam — e não um filtro
          dentro de cada cartão, que faria dois blocos vizinhos mostrarem períodos
          diferentes sem avisar. */}
      <div className="flex flex-wrap items-center gap-3">
        <Abas rotulo="Período" abas={PERIODOS} ativa={String(days)} aoTrocar={(c) => setDays(Number(c))} />

        {report && report.tenants.length > 0 && (
          <Seletor aria-label="Cliente" value={client} onChange={(e) => setClient(e.target.value)} className="w-64">
            <option value={ALL}>Todos os clientes ({report.tenants.length})</option>
            {report.tenants.map((t) => (
              <option key={tenantKey(t)} value={tenantKey(t)}>{t.tenant_name}</option>
            ))}
          </Seletor>
        )}

        <Button variant="outline" size="sm" aria-label="Recarregar" onClick={() => void load()} disabled={carregando} className="ml-auto">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {estado === 'erro' && (
        <EmptyState tipo="erro" title="Não deu pra carregar os resultados da IA" aoTentarDeNovo={() => void load()} />
      )}

      {carregando && !report && <div aria-busy="true" className={`h-64 ${ESQUELETO}`} />}

      {estado !== 'erro' && report && report.tenants.length === 0 && (
        <EmptyState
          title="Nenhuma IA com movimento no período"
          description="Os números aparecem conforme as IAs atendem."
        />
      )}

      {estado !== 'erro' && report && counts && report.tenants.length > 0 && (
        // Recarregar segura o desenho anterior mais apagado em vez de piscar um
        // esqueleto: trocar de período na frente do cliente não pode fazer a tela
        // sumir e voltar.
        <div className={`flex flex-col gap-6 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <AiResultsPanel
            counts={counts}
            series={series}
            caption={`Leads atendidos pela IA em ${selected?.tenant_name ?? 'todos os clientes'}`}
            seriesTitle={`Dia a dia ${selected ? `· ${selected.tenant_name}` : '· todos os clientes'}`}
          />

          {!selected && (
            <section aria-labelledby="por-cliente" className={SECAO}>
              <h3 id="por-cliente" className={TITULO_SECAO}>Por cliente</h3>
              <div className="mt-4 flex flex-col gap-1">
                {report.tenants.map((tenant) => (
                  <button
                    key={tenantKey(tenant)}
                    type="button"
                    onClick={() => setClient(tenantKey(tenant))}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2.5 text-left hover:bg-muted/40"
                  >
                    <span className="min-w-[8rem] flex-1 truncate text-sm font-medium">{tenant.tenant_name}</span>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {int(tenant.ai_leads)} atendidos
                    </span>
                    <span className="w-24 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                      {pct(tenant.reply_rate)} resposta
                    </span>
                    {/* O selo que o dono pediu: a visita marcada pela IA é o que
                        ele quer ver de relance ao lado do nome do cliente. Some
                        quando é zero — selo zerado num cliente novo tira o
                        destaque justamente de quem tem o número pra mostrar. */}
                    {tenant.visits > 0 && (
                      <span className={`${SELO} flex items-center gap-1 whitespace-nowrap border-primary/30 bg-primary/10 font-medium text-primary`}>
                        <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                        {tenant.visits} {tenant.visits === 1 ? 'visita pela IA' : 'visitas pela IA'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
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
