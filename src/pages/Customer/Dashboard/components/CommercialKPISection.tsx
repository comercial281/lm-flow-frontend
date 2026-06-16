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

interface KpiDef {
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  numColor: string;
  glowColor: string;
  displayValue: string | null;
  countTarget: number | null;
}

function KpiCard({ kpi }: { kpi: KpiDef }) {
  const Icon = kpi.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col gap-3 rounded-xl border bg-card/60 p-5 backdrop-blur-sm overflow-hidden"
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

      <div
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${kpi.iconBg}`}
        style={{
          boxShadow: hovered ? `0 0 18px ${kpi.glowColor}` : 'none',
          transition: 'box-shadow 0.22s ease',
        }}
      >
        <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
      </div>

      <div className="relative">
        <p className={`text-3xl font-bold tracking-tight leading-none ${kpi.numColor}`}>
          {kpi.countTarget !== null
            ? <CountUp target={kpi.countTarget} />
            : kpi.displayValue ?? '—'}
        </p>
        <p className="text-sm font-medium text-foreground mt-2 leading-tight">{kpi.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>
      </div>
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

  const kpis: KpiDef[] = [
    {
      label: 'Leads no pipeline',
      description: 'Oportunidades ativas em negociação',
      icon: TrendingUp,
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      numColor: 'text-violet-400',
      glowColor: 'rgba(124,58,237,0.16)',
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
      displayValue: null,
      countTarget: data.stats.total_conversations,
    },
    {
      label: 'Atendimentos concluídos',
      description: 'Conversas resolvidas no período',
      icon: CheckCircle2,
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-400',
      numColor: 'text-teal-400',
      glowColor: 'rgba(20,184,166,0.16)',
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
      displayValue: formatSeconds(data.stats.avg_resolution_time_seconds),
      countTarget: null,
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
          Visao geral do desempenho comercial no periodo filtrado
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} kpi={kpi} />
        ))}
      </div>
    </section>
  );
};

export default CommercialKPISection;
