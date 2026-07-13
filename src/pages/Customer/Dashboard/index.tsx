import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui/ds';
import { BaseHeader } from '@/components/base';
import { useAuthStore } from '@/store/authStore';
import type { HeaderFilter } from '@/components/base';
import { useLanguage } from '@/hooks/useLanguage';
import { pipelinesService } from '@/services/pipelines';
import TeamsService from '@/services/teams/teamsService';
import InboxesService from '@/services/channels/inboxesService';
import { usersService } from '@/services/users';
import { customerDashboardService } from '@/services/dashboard/customerDashboardService';
import type { CustomerDashboardParams, CustomerDashboardResponse } from '@/types/analytics/dashboard';
import DashboardFiltersDialog from './components/DashboardFiltersDialog';
import CommercialKPISection from './components/CommercialKPISection';
import DashboardMetricsSection from './components/DashboardMetricsSection';
import DashboardTrendsSection from './components/DashboardTrendsSection';
import DashboardPerformanceSection from './components/DashboardPerformanceSection';
import DashboardUpcomingVisits from './components/DashboardUpcomingVisits';
import type { DashboardFilterState, DashboardOption } from './components/types';
import { DashboardTour } from '@/tours';

const ALL_FILTER_VALUE = '__all__';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultFilterState = (): DashboardFilterState => {
  const untilDate = new Date();
  const sinceDate = new Date();
  sinceDate.setDate(untilDate.getDate() - 29);

  return {
    pipelineId: ALL_FILTER_VALUE,
    teamId: ALL_FILTER_VALUE,
    inboxId: ALL_FILTER_VALUE,
    userId: ALL_FILTER_VALUE,
    since: toDateInputValue(sinceDate),
    until: toDateInputValue(untilDate),
  };
};

const parseDateToUnix = (value: string, endOfDay: boolean) => {
  if (!value) return undefined;
  const datetime = endOfDay ? `${value}T23:59:59` : `${value}T00:00:00`;
  const timestamp = new Date(datetime).getTime();
  if (Number.isNaN(timestamp)) return undefined;
  return Math.floor(timestamp / 1000);
};

const normalizeDateRange = (filters: DashboardFilterState): DashboardFilterState => {
  if (!filters.since || !filters.until) return filters;
  if (filters.since <= filters.until) return filters;

  return {
    ...filters,
    since: filters.until,
    until: filters.since,
  };
};

const buildDashboardParams = (filters: DashboardFilterState): CustomerDashboardParams => {
  const params: CustomerDashboardParams = {};

  if (filters.pipelineId && filters.pipelineId !== ALL_FILTER_VALUE) params.pipeline_id = filters.pipelineId;
  if (filters.teamId && filters.teamId !== ALL_FILTER_VALUE) params.team_id = filters.teamId;
  if (filters.inboxId && filters.inboxId !== ALL_FILTER_VALUE) params.inbox_id = filters.inboxId;
  if (filters.userId && filters.userId !== ALL_FILTER_VALUE) params.user_id = filters.userId;

  const since = parseDateToUnix(filters.since, false);
  const until = parseDateToUnix(filters.until, true);

  if (since) params.since = since;
  if (until) params.until = until;

  return params;
};

const formatDateLabel = (value: string) => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

// Último payload por combinação de filtros (memória da sessão): voltar pro
// dashboard pinta os KPIs na hora e a versão fresca chega por trás.
const dashboardPayloadCache = new Map<string, CustomerDashboardResponse>();

const CustomerDashboardPage = () => {
  const { t } = useLanguage('customerDashboard');
  const currentUser = useAuthStore(s => s.currentUser);
  const [defaultFilters] = useState<DashboardFilterState>(() => getDefaultFilterState());
  const [data, setData] = useState<CustomerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DashboardFilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilterState>(defaultFilters);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [pipelines, setPipelines] = useState<DashboardOption[]>([]);
  const [teams, setTeams] = useState<DashboardOption[]>([]);
  const [inboxes, setInboxes] = useState<DashboardOption[]>([]);
  const [users, setUsers] = useState<DashboardOption[]>([]);

  const appliedFiltersRef = useRef(appliedFilters);
  appliedFiltersRef.current = appliedFilters;

  const loadDashboard = useCallback(async (filters: DashboardFilterState, silent = false) => {
    const params = buildDashboardParams(filters);
    const cacheKey = JSON.stringify(params);

    // Revisita com o mesmo filtro: pinta na hora com o payload anterior e
    // revalida silencioso por trás (stale-while-revalidate).
    const cached = dashboardPayloadCache.get(cacheKey);
    if (!silent && cached) {
      setData(cached);
      setLoading(false);
      setSilentRefreshing(true);
    } else if (silent) {
      setSilentRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await customerDashboardService.getCustomerDashboard(params);
      dashboardPayloadCache.set(cacheKey, response);
      setData(response);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading customer dashboard:', err);
      if (!silent && !cached) setError(t('dashboard.error') || 'Falha ao carregar dashboard');
    } finally {
      setLoading(false);
      setSilentRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadDashboard(appliedFilters);
  }, [appliedFilters, loadDashboard]);

  // Auto-refresh a cada 2 minutos + ao focar a aba
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard(appliedFiltersRef.current, true);
    }, 2 * 60 * 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadDashboard(appliedFiltersRef.current, true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [pipelinesResponse, teamsResponse, inboxesResponse, usersResponse] = await Promise.all([
          pipelinesService.getPipelines({ page: 1, per_page: 100, sort: 'name', order: 'asc' }),
          TeamsService.getTeams({ page: 1, per_page: 100, sort: 'name', order: 'asc' }),
          InboxesService.list(),
          usersService.getUsers({ page: 1, per_page: 100, sort: 'name', order: 'asc' }),
        ]);

        setPipelines((pipelinesResponse.data || []).map(item => ({ id: item.id, name: item.name })));
        setTeams((teamsResponse.data || []).map(item => ({ id: item.id, name: item.name })));
        setInboxes((inboxesResponse.data || []).map(item => ({ id: item.id, name: item.name })));
        setUsers((usersResponse.data || []).map(item => ({ id: item.id, name: item.available_name || item.name })));
      } catch (err) {
        console.error('Error loading dashboard filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  const normalizeAndSetDraft = (changes: Partial<DashboardFilterState>) => {
    setDraftFilters(prev => ({ ...prev, ...changes }));
  };

  const handleOpenFilter = () => {
    setDraftFilters(appliedFilters);
    setFilterModalOpen(true);
  };

  const handleApplyFilters = () => {
    const normalized = normalizeDateRange(draftFilters);
    setDraftFilters(normalized);
    setAppliedFilters(normalized);
    setFilterModalOpen(false);
  };

  const handleClearFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setFilterModalOpen(false);
  };

  const appliedHeaderFilters = useMemo<HeaderFilter[]>(() => {
    const filters: HeaderFilter[] = [];
    const pipeline = pipelines.find(item => item.id === appliedFilters.pipelineId);
    const team = teams.find(item => item.id === appliedFilters.teamId);
    const inbox = inboxes.find(item => item.id === appliedFilters.inboxId);
    const user = users.find(item => item.id === appliedFilters.userId);
    const hasCustomPeriod = appliedFilters.since !== defaultFilters.since || appliedFilters.until !== defaultFilters.until;

    if (pipeline) {
      filters.push({
        label: t('dashboard.filters.pipeline') || 'Pipeline',
        value: pipeline.name,
        onRemove: () => setAppliedFilters(prev => ({ ...prev, pipelineId: ALL_FILTER_VALUE })),
      });
    }

    if (team) {
      filters.push({
        label: t('dashboard.filters.team') || 'Equipe',
        value: team.name,
        onRemove: () => setAppliedFilters(prev => ({ ...prev, teamId: ALL_FILTER_VALUE })),
      });
    }

    if (inbox) {
      filters.push({
        label: t('dashboard.filters.channel') || 'Canal',
        value: inbox.name,
        onRemove: () => setAppliedFilters(prev => ({ ...prev, inboxId: ALL_FILTER_VALUE })),
      });
    }

    if (user) {
      filters.push({
        label: t('dashboard.filters.user') || 'Usuário',
        value: user.name,
        onRemove: () => setAppliedFilters(prev => ({ ...prev, userId: ALL_FILTER_VALUE })),
      });
    }

    if (hasCustomPeriod) {
      filters.push({
        label: t('dashboard.filters.period') || 'Período',
        value: `${formatDateLabel(appliedFilters.since)} - ${formatDateLabel(appliedFilters.until)}`,
        onRemove: () => setAppliedFilters(prev => ({ ...prev, since: defaultFilters.since, until: defaultFilters.until })),
      });
    }

    return filters;
  }, [appliedFilters, defaultFilters.since, defaultFilters.until, inboxes, pipelines, t, teams, users]);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    setAppliedFilters(prev => ({
      ...prev,
      pipelineId: prev.pipelineId !== ALL_FILTER_VALUE && !pipelines.some(item => item.id === prev.pipelineId)
        ? ALL_FILTER_VALUE
        : prev.pipelineId,
      teamId: prev.teamId !== ALL_FILTER_VALUE && !teams.some(item => item.id === prev.teamId)
        ? ALL_FILTER_VALUE
        : prev.teamId,
      inboxId: prev.inboxId !== ALL_FILTER_VALUE && !inboxes.some(item => item.id === prev.inboxId)
        ? ALL_FILTER_VALUE
        : prev.inboxId,
      userId: prev.userId !== ALL_FILTER_VALUE && !users.some(item => item.id === prev.userId)
        ? ALL_FILTER_VALUE
        : prev.userId,
    }));
  }, [inboxes, pipelines, teams, users]);

  const currentPeriodLabel = useMemo(() => {
    return `${formatDateLabel(appliedFilters.since)} - ${formatDateLabel(appliedFilters.until)}`;
  }, [appliedFilters.since, appliedFilters.until]);

  const channelShareData = useMemo(() => {
    if (!data) return [];

    const colors = ['#22c55e', '#3b82f6', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4'];

    return data.channels.map((channel, index) => ({
      name: channel.name,
      value: Number(channel.percentage.toFixed(2)),
      color: colors[index % colors.length],
    }));
  }, [data]);

  if (loading) {
    return <div className="p-4">{t('dashboard.loading') || 'Carregando dashboard...'}</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {error || (t('dashboard.error') || 'Falha ao carregar dashboard')}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dashHour = new Date().getHours();
  const dashGreeting =
    dashHour < 12 ? 'Bom dia' : dashHour < 18 ? 'Boa tarde' : 'Boa noite';
  const dashFirstName =
    (currentUser as { firstName?: string; name?: string } | null)?.firstName ||
    (currentUser as { firstName?: string; name?: string } | null)?.name?.split(' ')[0] ||
    '';
  const dashDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div
      className="h-full flex flex-col p-4 gap-6"
      style={{
        background:
          'radial-gradient(ellipse 70% 40% at 85% 0%, rgba(124,58,237,0.07) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 5% 100%, rgba(147,51,234,0.05) 0%, transparent 50%)',
      }}
    >
      <DashboardTour />
      <div data-tour="dashboard-header">
        <BaseHeader
          title={dashFirstName ? `${dashGreeting}, ${dashFirstName}` : dashGreeting}
          subtitle={`Resumo da operação — ${dashDate}`}
          filters={appliedHeaderFilters}
          onFilterClick={handleOpenFilter}
          showFilters
          filterButtonDataTour="dashboard-filter-button"
        />
      </div>

      <div className="-mt-3 flex items-center justify-end gap-3" data-tour="dashboard-period-badge">
        {lastUpdated && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: silentRefreshing ? '#f59e0b' : '#10b981',
                animation: silentRefreshing ? 'lmd-pulse-ring 1s ease-in-out infinite' : 'none',
              }}
            />
            {silentRefreshing
              ? 'Sincronizando...'
              : `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        )}
        <Badge variant="secondary">
          {currentPeriodLabel} ({data.period.days} dias)
        </Badge>
      </div>

      <CommercialKPISection data={data} />

      <div data-tour="dashboard-metrics">
        <DashboardMetricsSection data={data} t={t} />
      </div>
      <div data-tour="dashboard-trends">
        <DashboardTrendsSection data={data} t={t} channelShareData={channelShareData} />
      </div>
      <DashboardUpcomingVisits />
      <div data-tour="dashboard-performance">
        <DashboardPerformanceSection data={data} t={t} />
      </div>

      <DashboardFiltersDialog
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        draftFilters={draftFilters}
        onFiltersChange={normalizeAndSetDraft}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        pipelines={pipelines}
        teams={teams}
        inboxes={inboxes}
        users={users}
        allValue={ALL_FILTER_VALUE}
        t={t}
      />
    </div>
  );
};

export default CustomerDashboardPage;
