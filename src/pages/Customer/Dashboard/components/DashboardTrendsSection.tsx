import { BarChart3, Layers, TrendingUp } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds';
import { AreaChartCard, BarChartCard, DonutChartCard } from '@/components/charts';
import type { CustomerDashboardResponse } from '@/types/analytics/dashboard';
import { formatCurrency } from './dashboardUtils';
import { useTranslation } from '@/hooks/useTranslation';
import { TooltipInfo } from '@/components/base/TooltipInfo';

interface DashboardTrendsSectionProps {
  data: CustomerDashboardResponse;
  t: (key: string) => string;
  channelShareData: Array<{ name: string; value: number; color: string }>;
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

const DashboardTrendsSection = ({ data, t, channelShareData }: DashboardTrendsSectionProps) => {
  const { t: tTours } = useTranslation('tours');
  const tx = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const hasResultsData = data.trends.response_time_daily.length > 0;
  const responseTimeCardDescription = hasResultsData
    ? tx('dashboard.charts.sessionDescription', 'Média diária das sessões por dia')
    : tx('dashboard.charts.emptyState', 'Sem dados no período selecionado');

  const topChannel = data.channels[0];
  const top3Share = data.channels.slice(0, 3).reduce((sum, channel) => sum + channel.percentage, 0);
  const channelsRevenue = data.channels.reduce((sum, channel) => sum + channel.value, 0);

  return (
    <section className="space-y-4">
      <SectionHeader
        title={tx('dashboard.sections.trends', 'Tendências no tempo')}
        subtitle={tx('dashboard.sections.trendsSubtitle', 'Evolução da operação ao longo do período filtrado')}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div data-tour="dashboard-trends-conversations" className="h-full">
          <AreaChartCard
            title={t('dashboard.charts.visitorsTrend') || 'Conversas por dia'}
            description={t('dashboard.charts.visitorsDescription') || 'Tendência diária de conversas no período'}
            data={data.trends.conversations_daily}
            icon={TrendingUp}
            color="#22c55e"
            gradientFrom="#22c55e"
            gradientTo="#10b981"
            valueFormatter={value => value.toFixed(0)}
            tooltip={{ title: tTours('dashboard.step9.title'), content: tTours('dashboard.step9.content') }}
          />
        </div>

        <div data-tour="dashboard-channel-participation" className="h-full">
          <DonutChartCard
            title={t('dashboard.charts.channelShare') || 'Participação por canal'}
            description={t('dashboard.charts.channelShareDescription') || 'Distribuição percentual de conversas por canal'}
            data={channelShareData}
            icon={Layers}
            gradientFrom="#ec4899"
            gradientTo="#8b5cf6"
            centerLabel={tx('dashboard.charts.channelsLabel', 'Canais')}
            centerValue={tx('dashboard.charts.shareLabel', 'Participação')}
            tooltip={{ title: tTours('dashboard.step11.title'), content: tTours('dashboard.step11.content') }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div data-tour="dashboard-trends-response" className="h-full">
          <BarChartCard
            title={t('dashboard.charts.sessionDuration') || 'Tempo de 1ª resposta por dia'}
            description={responseTimeCardDescription}
            data={data.trends.response_time_daily}
            icon={BarChart3}
            color="#3b82f6"
            gradientFrom="#3b82f6"
            gradientTo="#8b5cf6"
            valueFormatter={value => `${Math.round(value)}s`}
            highlightMax
            tooltip={{ title: tTours('dashboard.step10.title'), content: tTours('dashboard.step10.content') }}
          />
        </div>

        {/* Channel insights — upgraded */}
        <Card
          data-tour="dashboard-channel-insights"
          className="relative overflow-hidden"
          style={{
            borderColor: 'rgba(124,58,237,0.15)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.03) 0%, transparent 60%)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl"
            style={{ background: 'rgba(124,58,237,0.07)' }}
          />
          <CardHeader className="pb-3 relative">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div
                className="w-0.5 h-4 rounded-full shrink-0"
                style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
              />
              {tx('dashboard.channels.insights', 'Insights de canais')}
              <TooltipInfo title={tTours('dashboard.step12.title')} content={tTours('dashboard.step12.content')} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            {/* Top channel */}
            <div
              className="rounded-xl border p-3 flex items-center justify-between gap-3"
              style={{
                borderColor: 'rgba(124,58,237,0.15)',
                background: 'rgba(124,58,237,0.04)',
              }}
            >
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">
                  {tx('dashboard.channels.topChannel', 'Canal líder')}
                </div>
                <div className="font-semibold text-sm">{topChannel?.name || '-'}</div>
              </div>
              <Badge
                variant="secondary"
                className="text-violet-400 bg-violet-500/10 border-violet-500/20 shrink-0"
              >
                {topChannel?.percentage?.toFixed(2) || '0.00'}%
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label={tx('dashboard.channels.concentration', 'Top 3 canais')}
                value={`${top3Share.toFixed(1)}%`}
              />
              <StatBox
                label={tx('dashboard.channels.activeCount', 'Canais ativos')}
                value={String(data.channels.length)}
              />
            </div>

            <StatBox
              label={tx('dashboard.channels.totalValue', 'Valor total gerado')}
              value={formatCurrency(channelsRevenue)}
              large
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

function StatBox({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={large ? 'text-2xl font-bold' : 'text-xl font-semibold'}>{value}</div>
    </div>
  );
}

export default DashboardTrendsSection;
