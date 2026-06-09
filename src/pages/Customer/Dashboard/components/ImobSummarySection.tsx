import { useEffect, useState } from 'react';
import { Building2, CalendarClock, FileSignature, ClipboardList, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { propertiesService } from '@/services/properties/propertiesService';
import { visitsService } from '@/services/visits/visitsService';
import { proposalsService } from '@/services/proposals/proposalsService';
import { propertyCaptureRequestsService } from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';

interface ImobStat {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
  href: string;
  description: string;
}

export default function ImobSummarySection() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ImobStat[]>([
    {
      label: 'Imóveis ativos',
      value: null,
      icon: Building2,
      color: 'text-violet-600 dark:text-violet-400',
      href: '/properties',
      description: 'Em carteira',
    },
    {
      label: 'Visitas hoje',
      value: null,
      icon: CalendarClock,
      color: 'text-blue-600 dark:text-blue-400',
      href: '/visits',
      description: 'Agendadas para hoje',
    },
    {
      label: 'Propostas em aberto',
      value: null,
      icon: FileSignature,
      color: 'text-orange-600 dark:text-orange-400',
      href: '/proposals',
      description: 'Aguardando resposta',
    },
    {
      label: 'Captações pendentes',
      value: null,
      icon: ClipboardList,
      color: 'text-emerald-600 dark:text-emerald-400',
      href: '/property-capture-requests',
      description: 'Aguardando análise',
    },
  ]);

  useEffect(() => {
    Promise.allSettled([
      propertiesService.list({ status: 'active', per_page: 1 }),
      visitsService.list({ today: 'true', per_page: 1 }),
      proposalsService.list({ status: 'sent', per_page: 1 }),
      propertyCaptureRequestsService.list({ status: 'pending_review' }),
    ]).then(([props, visits, proposals, captures]) => {
      setStats(prev => [
        {
          ...prev[0],
          value: props.status === 'fulfilled' ? (props.value.meta?.total ?? props.value.data?.length ?? 0) : 0,
        },
        {
          ...prev[1],
          value: visits.status === 'fulfilled' ? (visits.value.meta?.total ?? visits.value.data?.length ?? 0) : 0,
        },
        {
          ...prev[2],
          value: proposals.status === 'fulfilled' ? (proposals.value.meta?.total ?? proposals.value.data?.length ?? 0) : 0,
        },
        {
          ...prev[3],
          value: captures.status === 'fulfilled' ? (captures.value.meta?.total ?? captures.value.data?.length ?? 0) : 0,
        },
      ]);
    });
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Portfólio Imobiliário
        </h2>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => navigate(stat.href)}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value === null ? (
                    <span className="inline-block h-7 w-8 animate-pulse rounded bg-muted" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-sm font-medium text-foreground leading-tight">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
