import { useRef, useState, useEffect } from 'react';
import { TrendingUp, Banknote, Receipt, MessagesSquare, CheckCircle2, Clock } from 'lucide-react';
import { animate, useInView } from 'framer-motion';
import { formatCurrency, formatSeconds } from './dashboardUtils';
import type { CustomerDashboardResponse } from '@/types/analytics/dashboard';

function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    const c = animate(0, target, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1] as any,
      onUpdate(n: number) { setV(Math.round(n)); },
    });
    return () => c.stop();
  }, [isInView, target]);
  return <span ref={ref}>{v.toLocaleString('pt-BR')}</span>;
}

/** Sparkline com dado REAL (série diária). Sem dados => não renderiza nada. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 96;
  const h = 34;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      className="pointer-events-none absolute right-4 bottom-4 opacity-90"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface KpiDef {
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  numColor: string;
  glowColor: string;
  sparkColor: string;
  displayValue: string | null;
  countTarget: number | null;
  spark?: number[];
}

function KpiCard({ kpi }: { kpi: KpiDef }) {
  const Icon = kpi.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col gap-3 rounded-xl border bg-card/60 p-5 backdrop-blur-sm overflow-hidden min-h-[128px]"
      style={{
        borderColor: hovered ? kpi.glowColor.replace('0.16', '0.38') : 'rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 8px 32px ${kpi.glowColor}, 0 2px 8px rgba(0,0,0,0.18)`
          : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300"
        style={{ background: kpi.glowColor, opacity: hovered ? 1 : 0 }}
      />

      <div className="flex items-center gap-2.5">
        <div
          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${kpi.iconBg}`}
          style={{
            boxShadow: hovered ? `0 0 18px ${kpi.glowColor}` : 'none',
            transition: 'box-shadow 0.22s ease',
          }}
        >
          <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
        </div>
        <p className="text-sm font-medium text-muted-foreground leading-tight">{kpi.label}</p>
      </div>

      <div className="relative">
        <p className={`text-3xl font-bold tracking-tight leading-none ${kpi.numColor}`}>
          {kpi.countTarget !== null
            ? <CountUp target={kpi.countTarget} />
            : kpi.displayValue ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-tight max-w-[70%]">{kpi.description}</p>
      </div>

      {kpi.spark && <Sparkline values={kpi.spark} color={kpi.sparkColor} />}
    </div>
  );
}

interface Props {
  data: CustomerDashboardResponse;
}

const CommercialKPISection = ({ data }: Props) => {
  const avgTicket = data.pipeline.total > 0
    ? data.pipeline.total_value / data.pipeline.total
    : 0;

  const resolved = Math.max(0, data.stats.total_conversations - data.stats.open_conversations);

  // Série REAL de conversas por dia -> sparkline (nada inventado)
  const conversationsSpark = (data.trends?.conversations_daily || [])
    .map((d: any) => Number(d?.value ?? d?.count ?? d?.total ?? 0))
    .filter((n: number) => Number.isFinite(n));
  const responseSpark = (data.trends?.response_time_daily || [])
    .map((d: any) => Number(d?.value ?? d?.count ?? d?.total ?? 0))
    .filter((n: number) => Number.isFinite(n));

  const kpis: KpiDef[] = [
    {
      label: 'Leads no pipeline',
      description: 'Oportunidades ativas em negociação',
      icon: TrendingUp,
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      numColor: 'text-violet-400',
      glowColor: 'rgba(124,58,237,0.16)',
      sparkColor: '#a78bfa',
      displayValue: null,
      countTarget: data.pipeline.total,
    },
    {
      label: 'Valor do funil',
      description: 'Volume financeiro em aberto',
      icon: Banknote,
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      numColor: 'text-emerald-400',
      glowColor: 'rgba(16,185,129,0.16)',
      sparkColor: '#34d399',
      displayValue: formatCurrency(data.pipeline.total_value),
      countTarget: null,
    },
    {
      label: 'Ticket médio',
      description: 'Valor médio por lead no funil',
      icon: Receipt,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      numColor: 'text-blue-400',
      glowColor: 'rgba(59,130,246,0.16)',
      sparkColor: '#60a5fa',
      displayValue: formatCurrency(avgTicket),
      countTarget: null,
    },
    {
      label: 'Conversas no período',
      description: 'Total de atendimentos iniciados',
      icon: MessagesSquare,
      iconBg: 'bg-fuchsia-500/15',
      iconColor: 'text-fuchsia-400',
      numColor: 'text-fuchsia-400',
      glowColor: 'rgba(217,70,239,0.16)',
      sparkColor: '#e879f9',
      displayValue: null,
      countTarget: data.stats.total_conversations,
      spark: conversationsSpark.length >= 2 ? conversationsSpark : undefined,
    },
    {
      label: 'Atendimentos concluídos',
      description: 'Conversas resolvidas no período',
      icon: CheckCircle2,
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-400',
      numColor: 'text-teal-400',
      glowColor: 'rgba(20,184,166,0.16)',
      sparkColor: '#2dd4bf',
      displayValue: null,
      countTarget: resolved,
    },
    {
      label: 'Tempo de resolução',
      description: 'Média do ciclo completo de atendimento',
      icon: Clock,
      iconBg: 'bg-sky-500/15',
      iconColor: 'text-sky-400',
      numColor: 'text-sky-400',
      glowColor: 'rgba(14,165,233,0.16)',
      sparkColor: '#38bdf8',
      displayValue: formatSeconds(data.stats.avg_resolution_time_seconds),
      countTarget: null,
      spark: responseSpark.length >= 2 ? responseSpark : undefined,
    },
  ];

  return (
    <section>
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-6 rounded-full shrink-0"
            style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
          />
          <h2 className="text-lg font-semibold">KPIs Comerciais</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1 ml-4">
          Visão geral do desempenho comercial no período filtrado
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} kpi={kpi} />
        ))}
      </div>
    </section>
  );
};

export default CommercialKPISection;
