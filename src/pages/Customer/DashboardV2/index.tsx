import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { PeriodPicker } from './components/PeriodPicker';
import { KpiRow } from './components/KpiRow';
import { HistoryChart, LeadsChart, SourcesDonut } from './components/Charts';
import { Heatmap } from './components/Heatmap';
import {
  AgentSection, AutomationsSection, CapiSection, PipelineFunnel, ResponseTimeCard, UpcomingVisits,
} from './components/Sections';
import { EmptyBlock, GlassCard, Skeleton } from './components/primitives';
import { AdsSection } from './components/AdsSection';
import { isAvailable, type PeriodPreset } from './types';
import './styles/lmf.css';

/**
 * Dashboard do LM Flow — reconstruído do zero na identidade do protótipo.
 *
 * Não herda nada do dashboard anterior: componentes próprios namespaced `lmf-*`
 * em vez de reaproveitar os antigos. Trocar cor e token no que já existia nunca
 * vira outro design system, o DNA da tela antiga fica junto.
 *
 * Um único fetch alimenta todos os blocos, então KPI, série e funil nunca
 * discordam sobre qual é o período. Bloco sem fonte de dado mostra o motivo,
 * nunca zero — zero é lido como "não teve movimento", e isso seria mentira.
 */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const DashboardV2: React.FC = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<{ preset: PeriodPreset; since?: string; until?: string; pipelineId?: string }>({
    preset: 'this_month',
  });

  const { data, loading, error, reload } = useDashboardMetrics(filters);

  const subtitle = useMemo(() => {
    if (!data?.period) return 'Carregando período…';
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(data.period.since)} até ${fmt(data.period.until)} · comparado com o período anterior de mesmo tamanho`;
  }, [data?.period]);

  const firstName = (user?.name || '').trim().split(' ')[0];

  return (
    <div className="lmf">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.03em', margin: 0 }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="lmf-card-sub">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker
            preset={filters.preset}
            since={filters.since}
            until={filters.until}
            onChange={next => setFilters(prev => ({ ...prev, ...next }))}
          />
          <button type="button" className="lmf-select flex items-center gap-2" onClick={reload} aria-label="Atualizar">
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </header>

      {error && (
        <div className="lmf-glass lmf-card mb-5">
          <EmptyBlock text={error} />
        </div>
      )}

      <KpiRow kpis={isAvailable(data?.kpis) ? data?.kpis : undefined} loading={loading && !data} />

      <div className="lmf-grid lmf-grid-2" style={{ marginTop: 18 }}>
        <GlassCard title="Movimento no período" subtitle="Leads, conversas e visitas, com o período anterior sobreposto">
          {loading && !data ? <Skeleton height={300} /> : isAvailable(data?.series) ? <LeadsChart series={data.series} /> : <EmptyBlock block={data?.series} />}
        </GlassCard>

        <GlassCard
          title="Origem das captações"
          subtitle={
            isAvailable(data?.sources) && data.sources.new_leads !== undefined
              ? `${data.sources.total} captações · ${data.sources.new_leads} leads novos (o mesmo lead pode ser recapturado)`
              : 'De onde vieram as captações do período'
          }
        >
          {loading && !data ? <Skeleton height={230} /> : isAvailable(data?.sources) ? <SourcesDonut sources={data.sources} /> : <EmptyBlock block={data?.sources} />}
        </GlassCard>
      </div>

      <div className="lmf-grid lmf-grid-half" style={{ marginTop: 18 }}>
        {isAvailable(data?.pipeline) ? (
          <PipelineFunnel pipeline={data.pipeline} onSelect={id => setFilters(prev => ({ ...prev, pipelineId: id }))} />
        ) : (
          <GlassCard title="Funil do pipeline">
            {loading && !data ? <Skeleton height={200} /> : <EmptyBlock block={data?.pipeline} />}
          </GlassCard>
        )}

        {isAvailable(data?.agent) ? (
          <AgentSection agent={data.agent} />
        ) : (
          <GlassCard title="Agente">
            {loading && !data ? <Skeleton height={200} /> : <EmptyBlock block={data?.agent} />}
          </GlassCard>
        )}
      </div>

      <div className="lmf-grid lmf-grid-half" style={{ marginTop: 18 }}>
        {isAvailable(data?.automations) ? (
          <AutomationsSection automations={data.automations} />
        ) : (
          <GlassCard title="Automações">
            {loading && !data ? <Skeleton height={200} /> : <EmptyBlock block={data?.automations} />}
          </GlassCard>
        )}

        {isAvailable(data?.capi) ? (
          <CapiSection capi={data.capi} />
        ) : (
          <GlassCard title="Conversões CAPI">
            {loading && !data ? <Skeleton height={200} /> : <EmptyBlock block={data?.capi} />}
          </GlassCard>
        )}
      </div>

      <div className="lmf-grid lmf-grid-half" style={{ marginTop: 18 }}>
        {isAvailable(data?.upcoming) ? (
          <UpcomingVisits upcoming={data.upcoming} />
        ) : (
          <GlassCard title="Próximas visitas">
            {loading && !data ? <Skeleton height={200} /> : <EmptyBlock block={data?.upcoming} />}
          </GlassCard>
        )}

        {isAvailable(data?.response) ? (
          <ResponseTimeCard response={data.response} />
        ) : (
          <GlassCard title="Tempo de resposta">
            {loading && !data ? <Skeleton height={140} /> : <EmptyBlock block={data?.response} />}
          </GlassCard>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <GlassCard title="Mapa de calor" subtitle="Mensagens recebidas por dia da semana e horário">
          {loading && !data ? <Skeleton height={220} /> : isAvailable(data?.heatmap) ? <Heatmap heatmap={data.heatmap} /> : <EmptyBlock block={data?.heatmap} />}
        </GlassCard>
      </div>

      <div className="lmf-grid lmf-grid-half" style={{ marginTop: 18, marginBottom: 8 }}>
        <GlassCard title="Histórico por ano" subtitle="Todo o histórico registrado, independente do filtro acima">
          {loading && !data ? <Skeleton height={190} /> : isAvailable(data?.history) ? <HistoryChart history={data.history} /> : <EmptyBlock block={data?.history} />}
        </GlassCard>

        <AdsSection ads={data?.ads} onReload={reload} />
      </div>
    </div>
  );
};

export default DashboardV2;
