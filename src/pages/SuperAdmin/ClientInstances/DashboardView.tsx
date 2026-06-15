import { Loader2, BarChart3, TrendingUp, Users, MessageSquare, CheckCircle } from 'lucide-react';
import type { DashboardData } from '@/services/clientInstances/clientInstancesService';
import ClientMetricCard from './ClientMetricCard';

interface Props {
  data: DashboardData | null;
  loading: boolean;
  onArchive: (id: number) => void;
}

function OverviewCard({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
      <div className={`p-2 rounded-md ${accent ?? 'bg-primary/10'}`}>
        <Icon className={`h-4 w-4 ${accent ? 'text-white' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardView({ data, loading, onArchive }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando métricas...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Nenhum dado disponível.
      </div>
    );
  }

  const { instances, overview } = data;
  const healthPct = overview.total_count > 0
    ? Math.round((overview.healthy_count / overview.total_count) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Visao geral */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Visao Geral
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <OverviewCard
            icon={CheckCircle}
            label="Saude"
            value={`${healthPct}% ok`}
            accent={healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-orange-400' : 'bg-red-500'}
          />
          <OverviewCard
            icon={TrendingUp}
            label="Custo total"
            value={`R$ ${fmt(overview.total_monthly_cost_brl)}`}
          />
          <OverviewCard
            icon={Users}
            label="Total leads"
            value={overview.total_leads.toLocaleString('pt-BR')}
          />
          <OverviewCard
            icon={MessageSquare}
            label="Mensagens"
            value={overview.total_messages.toLocaleString('pt-BR')}
          />
        </div>
      </div>

      {/* Cards por cliente */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Por cliente ({instances.length})
        </p>
        {instances.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-20 mr-2" />
            Nenhum cliente ativo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {instances.map(i => (
              <ClientMetricCard
                key={i.id}
                instance={i}
                onArchive={() => onArchive(i.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
