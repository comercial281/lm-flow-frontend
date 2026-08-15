import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowRight, BarChart3, CalendarCheck, Clock, Loader2, Moon, MessageSquare,
  RefreshCw, Sparkles, Table2, Target, UserCheck, Users, type LucideIcon,
} from 'lucide-react';

import {
  superAgentsService,
  type PerformanceCounts,
  type PerformancePoint,
  type PerformanceReport,
  type PerformanceTenant,
} from '@/services/superAdmin/superAgentsService';

// Resultados da IA — a tela que o dono abre NA FRENTE do cliente.
//
// O Custo da IA responde "quanto gastei". Esta responde a pergunta que a
// imobiliária faz: "isso está funcionando?". Por isso nenhum token e nenhum dólar
// aparecem aqui — o que convence é lead atendido, lead que respondeu e visita
// marcada. O custo continua na tela dele, que é onde ele importa.
//
// Duas escolhas de leitura que valem a pena preservar:
//
// 1. O topo é um FUNIL, lido da esquerda pra direita: atendidos → responderam →
//    qualificados → visitas. Quatro números soltos deixam a conta pro leitor; o
//    funil já entrega a história ("de 400 leads, 12 viraram visita").
// 2. Sem atendimento no período a taxa aparece como "—", nunca "0%". Zero por
//    cento acusa a IA de um fracasso que não houve, e seria exatamente o que
//    estaria projetado no cliente que acabou de ligar a IA.

const ALL = '__todos__';

const PERIODS: [number, string][] = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];

// Duas identidades, e só duas: roxo = o que a IA atendeu, verde = visita marcada.
// O par passa nas seis checagens de daltonismo e contraste NOS DOIS TEMAS
// (claro e escuro), então a tela não precisa trocar de cor junto com o tema —
// uma cor por entidade, sempre a mesma, é também o que faz o gráfico e o número
// lá em cima serem lidos como a mesma coisa.
const COLOR_LEADS = '#7c3aed';
const COLOR_VISITS = '#059669';
// Cinza dos eixos e da grade: recessivo o bastante pra não competir com os dados
// e legível sobre fundo claro e escuro, sem depender de variável de tema.
const AXIS = '#94a3b8';

export default function ResultadosIA() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [days, setDays] = useState(30);
  const [client, setClient] = useState<string>(ALL);
  const [asTable, setAsTable] = useState(false);
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
  const hasMovement = series.some((p) => p.leads || p.replies || p.visits);

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
          <Funnel counts={counts} scope={selected?.tenant_name ?? 'todos os clientes'} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
            <Small icon={MessageSquare} label="Mensagens respondidas" value={int(counts.replies)} />
            <Small icon={Clock} label="Tempo de resposta" value={latency(counts.median_latency_ms)} />
            <Small
              icon={Moon}
              label="Fora do expediente"
              value={int(counts.after_hours_replies)}
              hint="Respostas em fim de semana ou fora das 8h–18h — o que ninguém teria atendido."
            />
            <Small icon={UserCheck} label="Passados para um corretor" value={int(counts.handoffs)} />
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold">
                Dia a dia {selected ? `· ${selected.tenant_name}` : '· todos os clientes'}
              </h2>
              {/* O gráfico não pode ser o único jeito de ler um valor. */}
              <button
                type="button"
                onClick={() => setAsTable((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                {asTable ? 'Ver gráfico' : 'Ver tabela'}
              </button>
            </div>

            {!hasMovement ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-sidebar-border bg-sidebar p-4">
                Nenhum atendimento registrado neste período.
              </p>
            ) : asTable ? (
              <DailyTable series={series} />
            ) : (
              // Dois gráficos, e não duas linhas no mesmo eixo: respostas vêm às
              // centenas e visita vem à unidade, então no eixo compartilhado a
              // visita — que é justamente o que a tela quer provar — viraria uma
              // linha colada no zero.
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Leads atendidos pela IA" hint="Leads distintos que a IA respondeu no dia.">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLOR_LEADS} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={COLOR_LEADS} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={AXIS} strokeOpacity={0.2} vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(value) => dayLabel(value)} tick={axisTick} tickLine={false} axisLine={false} minTickGap={22} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                      <Tooltip
                        content={<ChartTip title="Leads atendidos" color={COLOR_LEADS} dataKey="leads" />}
                        cursor={{ stroke: AXIS, strokeOpacity: 0.5, strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="leads" stroke={COLOR_LEADS} strokeWidth={2} fill="url(#fillLeads)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Visitas agendadas pela IA" hint="Visitas que a própria IA marcou na conversa, sem corretor.">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
                      <CartesianGrid stroke={AXIS} strokeOpacity={0.2} vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(value) => dayLabel(value)} tick={axisTick} tickLine={false} axisLine={false} minTickGap={22} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                      <Tooltip
                        content={<ChartTip title="Visitas agendadas" color={COLOR_VISITS} dataKey="visits" />}
                        cursor={{ fill: AXIS, fillOpacity: 0.12 }}
                      />
                      <Bar dataKey="visits" fill={COLOR_VISITS} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </section>

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

// ── Funil ───────────────────────────────────────────────────────────────────

// Atendidos → responderam → qualificados → visitas, com a conversão entre as
// etapas escrita por extenso. As setas não são enfeite: são elas que dizem que os
// quatro números são o MESMO grupo de leads afunilando, e não quatro contagens
// independentes que por acaso ficaram lado a lado.
function Funnel({ counts, scope }: { counts: PerformanceCounts; scope: string }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <Users className="h-4 w-4 text-muted-foreground self-center" />
        <span className="text-xs text-muted-foreground">Leads atendidos pela IA em {scope}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {/* Um único número de destaque na tela — o topo do funil, que é o que a
            IA de fato tocou. */}
        <div>
          <div className="text-5xl font-semibold leading-none" style={{ color: COLOR_LEADS }}>
            {int(counts.ai_leads)}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">leads atendidos</div>
        </div>

        <Step
          value={int(counts.answered)}
          label="responderam a IA"
          rate={pct(counts.reply_rate)}
          icon={MessageSquare}
        />
        <Step
          value={int(counts.qualified)}
          label="chegaram no ponto da visita"
          rate={pct(counts.qualify_rate)}
          icon={Target}
        />
        <Step
          value={int(counts.visits)}
          label={counts.visits === 1 ? 'visita agendada pela IA' : 'visitas agendadas pela IA'}
          rate={counts.visits_completed > 0 ? `${int(counts.visits_completed)} já aconteceram` : undefined}
          icon={CalendarCheck}
          color={COLOR_VISITS}
        />
      </div>
    </div>
  );
}

function Step({
  value, label, rate, icon: Icon, color,
}: {
  value: string;
  label: string;
  rate?: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <ArrowRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      <div>
        <div className="text-2xl font-semibold leading-none" style={color ? { color } : undefined}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <Icon className="h-3 w-3" /> {label}
        </div>
        {rate && <div className="text-xs text-muted-foreground/80 mt-0.5">{rate}</div>}
      </div>
    </div>
  );
}

function Small({
  icon: Icon, label, value, hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-3" title={hint}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

// ── Gráficos ────────────────────────────────────────────────────────────────

const axisTick = { fill: AXIS, fontSize: 11 };

function ChartCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
      <div className="mb-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      {children}
    </div>
  );
}

// Tooltip em classes do tema (e não em cor fixa) pra acompanhar claro/escuro; a
// bolinha colorida é que carrega a identidade da série, não o texto.
//
// ⚠️ A legenda da série chama-se `title`, e não `label`: o Recharts CLONA este
// elemento injetando as props dele — inclusive `label`, que é o valor do eixo X.
// Com o nome `label` a nossa legenda seria sobrescrita por "2026-08-14" e o
// tooltip diria "412 2026-08-14".
function ChartTip({
  active, payload, title, color, dataKey,
}: {
  active?: boolean;
  payload?: Array<{ payload: PerformancePoint }>;
  title: string;
  color: string;
  dataKey: 'leads' | 'visits';
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-sidebar-border bg-popover text-popover-foreground px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground">{dayLabel(point.day, true)}</div>
      <div className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {int(point[dataKey])} <span className="font-normal text-muted-foreground">{title.toLowerCase()}</span>
      </div>
    </div>
  );
}

function DailyTable({ series }: { series: PerformancePoint[] }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-sidebar-border">
            <th className="text-left font-medium px-3 py-2">Dia</th>
            <th className="text-right font-medium px-3 py-2">Leads atendidos</th>
            <th className="text-right font-medium px-3 py-2">Mensagens respondidas</th>
            <th className="text-right font-medium px-3 py-2">Visitas agendadas</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.day} className="border-b border-sidebar-border/50 last:border-0">
              <td className="px-3 py-1.5 tabular-nums">{dayLabel(point.day, true)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{int(point.leads)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{int(point.replies)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{int(point.visits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Formatação ──────────────────────────────────────────────────────────────

function tenantKey(tenant: PerformanceTenant): string {
  return tenant.tenant_slug ?? 'raiz';
}

function int(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR');
}

// "—" e não "0%": sem atendimento no período não existe taxa, e mostrar zero
// seria afirmar um fracasso que não aconteceu.
function pct(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function latency(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
}

// A data vem como "2026-08-14". `new Date("2026-08-14")` é lido como MEIA-NOITE
// EM UTC, que em Brasília é 21h do dia 13 — o eixo inteiro andaria um dia pra
// trás. Montar a data pelos pedaços resolve, e é o que mantém o gráfico alinhado
// com a série que o backend já agrupou no fuso de São Paulo.
// ⚠️ Nos eixos, chame como `(value) => dayLabel(value)`, nunca `tickFormatter={dayLabel}`:
// o Recharts passa `(valor, ÍNDICE)`, e o índice cairia no `long` — todo rótulo
// menos o do índice 0 sairia por extenso e o eixo viraria uma parede de texto.
function dayLabel(iso: string, long = false): string {
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return String(iso);
  const date = new Date(year, month - 1, day);
  return long
    ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
