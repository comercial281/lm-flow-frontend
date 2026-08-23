import { Building2, Wifi, WifiOff, Server, MessageSquare, Users, LayoutList, Archive } from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import { Button } from '@/components/ui/ds';
import type { ClientInstance } from '@/services/clientInstances/clientInstancesService';

interface Props {
  instance: ClientInstance;
  onArchive: () => void;
}

function HealthBadge({ ok, labelOk, labelFail }: { ok: boolean; labelOk: string; labelFail: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    }`}>
      {ok ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {ok ? labelOk : labelFail}
    </span>
  );
}

function MetricRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function fmt(n: number | null | undefined, prefix = '') {
  if (n == null) return '–';
  return `${prefix}${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ClientMetricCard({ instance, onArchive }: Props) {
  const snap = instance.snapshot;
  const hasData = !!snap;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-md">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{instance.name}</p>
            <p className="text-xs text-muted-foreground">{instance.admin_email}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-600 shrink-0"
          title="Arquivar"
          onClick={onArchive}
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Health badges */}
      <div className="flex flex-wrap gap-1.5">
        {hasData ? (
          <>
            <HealthBadge ok={snap.backend_reachable}   labelOk="Backend ok"  labelFail="Backend off" />
            <HealthBadge ok={snap.evolution_connected} labelOk="Evolution ok" labelFail="Evolution off" />
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">Sem snapshot — sincronizando...</span>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 pt-1 border-t">
        <MetricRow icon={Users}         label="Leads"       value={hasData ? snap.leads_count.toLocaleString('pt-BR') : '–'} />
        <MetricRow icon={MessageSquare} label="Conversas"   value={hasData ? snap.conversations_count.toLocaleString('pt-BR') : '–'} />
        <MetricRow icon={LayoutList}    label="Mensagens"   value={hasData ? snap.messages_count.toLocaleString('pt-BR') : '–'} />
      </div>

      {/* Cost */}
      <div className="pt-2 border-t space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Server className="h-3 w-3" />
            Railway
          </span>
          <span className="text-xs font-medium">
            {hasData ? `R$ ${fmt(snap.railway_monthly_cost_brl)}` : '–'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Evolution (rateio)
          </span>
          <span className="text-xs font-medium">
            {hasData ? `R$ ${fmt(snap.evolution_cost_brl)}` : '–'}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-dashed">
          <span className="text-xs font-semibold">Total mensal est.</span>
          <span className={`text-sm font-bold ${hasData && snap.total_monthly_cost_brl ? 'text-primary' : 'text-muted-foreground'}`}>
            {hasData ? `R$ ${fmt(snap.total_monthly_cost_brl)}` : '–'}
          </span>
        </div>
      </div>

      {snap && (
        <p className="text-[10px] text-muted-foreground text-right">
          Atualizado: {formatDateBR(snap.date)}
        </p>
      )}
    </div>
  );
}
