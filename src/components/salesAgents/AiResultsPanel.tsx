import { useId, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowRight, BarChart3, CalendarCheck, Clock, Moon, MessageSquare,
  Table2, Target, UserCheck, Users, type LucideIcon,
} from 'lucide-react';

import type { PerformanceCounts, PerformancePoint } from '@/types/aiResults';
import { COLOR_LEADS, COLOR_VISITS, dayLabel, int, latency, pct } from './aiResultsFormat';

// O painel de Resultados da IA, usado em DOIS lugares: na Área do Admin (todos os
// clientes, ou um escolhido) e na aba Resultados da IA dentro do CRM do cliente.
//
// É um componente só de propósito. O backend já garante que os dois lados leem a
// mesma medição; se a APRESENTAÇÃO fosse duplicada, ela é que passaria a divergir
// — um lado ganharia um número novo, o outro não, e a diferença apareceria numa
// reunião. Aqui, o que muda num lugar muda nos dois.
//
// Duas escolhas de leitura que valem a pena preservar:
//
// 1. O topo é um FUNIL, lido da esquerda para a direita: atendidos → responderam
//    → qualificados → visitas. Quatro números soltos deixam a conta pro leitor; o
//    funil já entrega a história ("de 400 leads, 12 viraram visita").
// 2. Sem atendimento no período a taxa aparece como "—", nunca "0%". Zero por
//    cento acusa a IA de um fracasso que não houve, e seria exatamente o que
//    estaria projetado no cliente que acabou de ligar a IA.

// Cinza dos eixos e da grade: recessivo o bastante pra não competir com os dados
// e legível sobre fundo claro e escuro, sem depender de variável de tema.
const AXIS = '#94a3b8';

const axisTick = { fill: AXIS, fontSize: 11 };

interface Props {
  counts: PerformanceCounts;
  series: PerformancePoint[];
  /** A frase INTEIRA do topo, escrita por quem chama. O painel não a monta porque
   *  "…pela IA em {escopo}" lê bem com nome de cliente ("em Moeda Forte") e mal
   *  com nome de agente ("em Sofia"): quem sabe do que está falando é a tela. */
  caption: string;
  /** Título da seção diária. */
  seriesTitle: string;
}

export default function AiResultsPanel({ counts, series, caption, seriesTitle }: Props) {
  const [asTable, setAsTable] = useState(false);
  // O gradiente precisa de id único: com o id fixo, dois painéis na mesma página
  // (ou um remontado) disputariam a mesma definição e a área ficaria sem pintura.
  const gradientId = `fillLeads-${useId().replace(/:/g, '')}`;
  const hasMovement = series.some((p) => p.leads || p.replies || p.visits);

  return (
    <>
      <Funnel counts={counts} caption={caption} />

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
          <h2 className="text-sm font-semibold">{seriesTitle}</h2>
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
          // centenas e visita vem à unidade, então no eixo compartilhado a visita
          // — que é justamente o que a tela quer provar — viraria uma linha colada
          // no zero.
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Leads atendidos pela IA" hint="Leads distintos que a IA respondeu no dia.">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="leads" stroke={COLOR_LEADS} strokeWidth={2} fill={`url(#${gradientId})`} />
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
    </>
  );
}

// ── Funil ───────────────────────────────────────────────────────────────────

// Atendidos → responderam → qualificados → visitas, com a conversão entre as
// etapas escrita por extenso. As setas não são enfeite: são elas que dizem que os
// quatro números são o MESMO grupo de leads afunilando, e não quatro contagens
// independentes que por acaso ficaram lado a lado.
function Funnel({ counts, caption }: { counts: PerformanceCounts; caption: string }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <Users className="h-4 w-4 text-muted-foreground self-center" />
        <span className="text-xs text-muted-foreground">{caption}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {/* Um único número de destaque — o topo do funil, que é o que a IA de
            fato tocou. */}
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
