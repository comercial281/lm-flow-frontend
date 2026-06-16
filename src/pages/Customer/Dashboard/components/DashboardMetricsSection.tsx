import { Clock, MessageSquare, CheckCircle2, AlertTriangle, UserX } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@evoapi/design-system';
import type { CustomerDashboardResponse } from '@/types/analytics/dashboard';
import DashboardMetricCard from './DashboardMetricCard';
import { formatSeconds } from './dashboardUtils';
import { useTranslation } from '@/hooks/useTranslation';
import { TooltipInfo } from '@/components/base/TooltipInfo';

interface DashboardMetricsSectionProps {
  data: CustomerDashboardResponse;
  t: (key: string) => string;
}

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_PULSE: Record<Tone, string> = {
  good: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  neutral: '#7c3aed',
};

const TONE_BADGE: Record<Tone, string> = {
  good: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  warning: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
  critical: 'border-red-500/40 text-red-400 bg-red-500/10',
  neutral: 'border-violet-500/40 text-violet-400 bg-violet-500/10',
};

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: color, animation: 'lmd-pulse-ring 2s ease-in-out infinite' }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div
          className="w-1 h-6 rounded-full shrink-0"
          style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
        />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1 ml-4">{subtitle}</p>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  value,
  statusLabel,
  statusTone,
  description,
  dataTour,
  tooltip,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  value: number;
  statusLabel: string;
  statusTone: Tone;
  description: string;
  dataTour?: string;
  tooltip?: { title: string; content: string };
}) {
  const pulseColor = TONE_PULSE[statusTone];
  return (
    <Card
      className="relative overflow-hidden"
      data-tour={dataTour}
      style={{
        borderColor: `${pulseColor}22`,
        background: `linear-gradient(135deg, ${pulseColor}06 0%, transparent 70%)`,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <span className="truncate">{title}</span>
          {tooltip && <TooltipInfo title={tooltip.title} content={tooltip.content} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <PulseDot color={pulseColor} />
            <span className="text-3xl font-bold tracking-tight" style={{ color: pulseColor }}>
              {value}
            </span>
          </div>
          <Badge variant="outline" className={TONE_BADGE[statusTone]}>
            {statusLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

const DashboardMetricsSection = ({ data, t }: DashboardMetricsSectionProps) => {
  const { t: tTours } = useTranslation('tours');
  const tx = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const responseStatus = data.stats.avg_first_response_time_seconds <= 60
    ? { label: tx('dashboard.status.good', 'Dentro do SLA'), tone: 'good' as const }
    : data.stats.avg_first_response_time_seconds <= 180
      ? { label: tx('dashboard.status.warning', 'Atenção'), tone: 'warning' as const }
      : { label: tx('dashboard.status.critical', 'Crítico'), tone: 'critical' as const };

  const csatStatus = data.csat.total_responses === 0
    ? { label: tx('dashboard.status.noSample', 'Sem base'), tone: 'neutral' as const }
    : data.csat.avg_rating >= 4
      ? { label: tx('dashboard.status.good', 'Bom'), tone: 'good' as const }
      : data.csat.avg_rating >= 3
        ? { label: tx('dashboard.status.warning', 'Atenção'), tone: 'warning' as const }
        : { label: tx('dashboard.status.critical', 'Crítico'), tone: 'critical' as const };

  const followUpStatus = data.follow_ups.pending === 0
    ? { label: tx('dashboard.status.good', 'Em dia'), tone: 'good' as const }
    : data.follow_ups.pending <= 10
      ? { label: tx('dashboard.status.warning', 'Atenção'), tone: 'warning' as const }
      : { label: tx('dashboard.status.critical', 'Atraso alto'), tone: 'critical' as const };

  const unassignedStatus = data.stats.unassigned_conversations === 0
    ? { label: tx('dashboard.status.good', 'Cobertura ok'), tone: 'good' as const }
    : data.stats.unassigned_conversations <= 5
      ? { label: tx('dashboard.status.warning', 'Atenção'), tone: 'warning' as const }
      : { label: tx('dashboard.status.critical', 'Risco operacional'), tone: 'critical' as const };

  return (
    <section className="space-y-4">
      <SectionHeader
        title={tx('dashboard.sections.statusNow', 'Status da operação agora')}
        subtitle={tx('dashboard.sections.statusNowSubtitle', 'Indicadores-chave para leitura rápida da saúde operacional')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div data-tour="dashboard-messages-card" className="h-full">
          <DashboardMetricCard
            title={t('dashboard.stats.incomingMessages') || 'Mensagens recebidas'}
            value={data.stats.incoming_messages_count}
            subtitle={`${data.stats.outgoing_messages_count} ${t('dashboard.stats.sent')}`}
            icon={MessageSquare}
            accentClassName="bg-fuchsia-500/20 text-fuchsia-400"
            importance="primary"
            status={{ label: tx('dashboard.status.volume', 'Volume no período'), tone: 'neutral' }}
            tooltip={{ title: tTours('dashboard.step2.title'), content: tTours('dashboard.step2.content') }}
          />
        </div>

        <div data-tour="dashboard-response-time-card" className="h-full">
          <DashboardMetricCard
            title={t('dashboard.stats.avgResponseTime')}
            value={formatSeconds(data.stats.avg_first_response_time_seconds)}
            subtitle={t('dashboard.stats.realData') || 'Dados reais'}
            icon={Clock}
            accentClassName="bg-emerald-500/20 text-emerald-400"
            importance="primary"
            status={responseStatus}
            tooltip={{ title: tTours('dashboard.step3.title'), content: tTours('dashboard.step3.content') }}
          />
        </div>

        <div data-tour="dashboard-csat-card" className="h-full">
          <DashboardMetricCard
            title={t('dashboard.csat.avg') || 'CSAT médio'}
            value={`${data.csat.avg_rating.toFixed(2)} / 5`}
            subtitle={`${data.csat.total_responses} ${t('dashboard.csat.responses') || 'avaliações'}`}
            icon={CheckCircle2}
            accentClassName="bg-violet-500/20 text-violet-400"
            importance="primary"
            status={csatStatus}
            tooltip={{ title: tTours('dashboard.step4.title'), content: tTours('dashboard.step4.content') }}
          />
        </div>

        <div data-tour="dashboard-followups-card" className="h-full">
          <DashboardMetricCard
            title={t('dashboard.stats.followUpsPending')}
            value={data.follow_ups.pending}
            subtitle={`${data.follow_ups.overdue} ${tx('dashboard.status.overdue', 'em atraso')}`}
            icon={AlertTriangle}
            accentClassName="bg-violet-500/20 text-violet-400"
            importance="primary"
            status={followUpStatus}
            tooltip={{ title: tTours('dashboard.step5.title'), content: tTours('dashboard.step5.content') }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatusCard
          icon={MessageSquare}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/15"
          title={tx('dashboard.stats.activeConversations', 'Conversas ativas agora')}
          value={data.stats.open_conversations}
          statusLabel={data.stats.open_conversations > 0
            ? tx('dashboard.status.monitor', 'Monitorar')
            : tx('dashboard.status.good', 'Estável')}
          statusTone={data.stats.open_conversations > 0 ? 'warning' : 'good'}
          description={tx('dashboard.status.currentBacklog', 'Backlog operacional atual')}
          dataTour="dashboard-active-conversations"
          tooltip={{ title: tTours('dashboard.step7.title'), content: tTours('dashboard.step7.content') }}
        />

        <StatusCard
          icon={UserX}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/15"
          title={tx('dashboard.stats.unassignedConversations', 'Sem responsável')}
          value={data.stats.unassigned_conversations}
          statusLabel={unassignedStatus.label}
          statusTone={unassignedStatus.tone}
          description={`${data.stats.pending_conversations} ${tx('dashboard.status.pendingNow', 'pendentes agora')}`}
          dataTour="dashboard-unassigned"
          tooltip={{ title: tTours('dashboard.step8.title'), content: tTours('dashboard.step8.content') }}
        />
      </div>
    </section>
  );
};

export default DashboardMetricsSection;
