import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { PeriodPicker } from './components/PeriodPicker';
import { ScopePicker } from './components/ScopePicker';
import { InstancePicker } from './components/InstancePicker';
import { KpiRow } from './components/KpiRow';
import { HistoryChart, LeadsChart, SourcesDonut } from './components/Charts';
import { Heatmap } from './components/Heatmap';
import {
  AgentSection, AutomationsSection, CapiSection, PipelineFunnel, QueueCard, ResponseTimeCard, UpcomingVisits,
} from './components/Sections';
import { EmptyBlock, GlassCard, Skeleton } from './components/primitives';
import { AdsSection } from './components/AdsSection';
import { RoletaSection } from './components/RoletaSection';
import { isAvailable, type PeriodPreset, type ScopeMode } from './types';
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

const SCOPE_SUBTITLE: Record<ScopeMode, string> = {
  mine: 'seus números',
  team: 'sua equipe',
  all: 'toda a imobiliária',
};

const DashboardV2: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{
    preset: PeriodPreset; since?: string; until?: string; pipelineId?: string; scope?: ScopeMode; inboxId?: string;
  }>({ preset: 'this_month' });
  // Só pro texto do subtítulo — o InstancePicker já resolveu o rótulo ao
  // buscar a lista, não vale a pena o dashboard buscar de novo só por isso.
  const [instanceLabel, setInstanceLabel] = useState<string>();

  const { data, loading, error, reload } = useDashboardMetrics(filters);

  const subtitle = useMemo(() => {
    if (!data?.period) return 'Carregando período…';
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const periodo = `${fmt(data.period.since)} até ${fmt(data.period.until)}`;
    // Dizer de quem são os números em texto, e não só no seletor: sem isso o
    // gestor lê "180 leads" sem saber se é a casa ou a equipe dele.
    const dono = data.scope ? ` · ${SCOPE_SUBTITLE[data.scope.mode]}` : '';
    const instancia = filters.inboxId && instanceLabel ? ` · ${instanceLabel}` : '';
    return `${periodo}${dono}${instancia} · comparado com o período anterior de mesmo tamanho`;
  }, [data?.period, data?.scope, filters.inboxId, instanceLabel]);

  const firstName = (user?.name || '').trim().split(' ')[0];

  // Blocos sem dono: o backend informa quais mandou. Enquanto o payload não
  // chegou os dois ficam falsos, para o corretor não ver o card aparecer e
  // sumir — o que se lê como "tirou alguma coisa de mim".
  const showOperations = data?.scope?.blocks?.operations ?? false;
  const showAds = data?.scope?.blocks?.media_spend ?? false;

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
          {/* Some sozinho pra quem não tem escolha de escopo (corretor). */}
          <ScopePicker scope={data?.scope} onChange={scope => setFilters(prev => ({ ...prev, scope }))} />
          {/* Some sozinho com menos de 2 instâncias — mesma regra do seletor do chat. */}
          <InstancePicker
            value={filters.inboxId}
            onChange={(inboxId, label) => {
              setFilters(prev => ({ ...prev, inboxId }));
              setInstanceLabel(label);
            }}
          />
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

      {/* Lead sem dono fica FORA dos KPIs: se entrasse, dois corretores
          contariam o mesmo lead e a soma das partes passaria o total do gestor.
          Aqui ele aparece sem contaminar número nenhum. */}
      {isAvailable(data?.queue) && (
        <div style={{ marginTop: 18 }}>
          <QueueCard queue={data.queue} onOpen={() => navigate('/conversations')} />
        </div>
      )}

      {/* Some sozinho para quem não lê roletas (corretor) — por isso fica fora
          da grade, sem reservar coluna vazia na tela dele. */}
      <RoletaSection />

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

      {/* Automações e CAPI não têm dono pra recortar: são números de plataforma.
          O backend OMITE as chaves pra quem não tem dashboard.operations — daí o
          teste ser por `!== undefined` e não pelo isAvailable, que só distingue
          bloco vazio de bloco cheio. Renderiza só depois que o payload chega,
          senão o corretor veria os dois cards piscarem antes de sumir. */}
      {showOperations && (
        <div className="lmf-grid lmf-grid-half" style={{ marginTop: 18 }}>
          {isAvailable(data?.automations) ? (
            <AutomationsSection automations={data.automations} />
          ) : (
            <GlassCard title="Automações">
              <EmptyBlock block={data?.automations} />
            </GlassCard>
          )}

          {isAvailable(data?.capi) ? (
            <CapiSection capi={data.capi} />
          ) : (
            <GlassCard title="Conversões CAPI">
              <EmptyBlock block={data?.capi} />
            </GlassCard>
          )}
        </div>
      )}

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

        {/* Gasto de mídia é dinheiro da empresa, não tem dono pra recortar: a
            chave `ads` só vem pra quem tem dashboard.media_spend. */}
        {showAds && <AdsSection ads={data?.ads} onReload={reload} />}
      </div>
    </div>
  );
};

export default DashboardV2;
