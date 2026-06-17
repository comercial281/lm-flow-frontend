import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, MessageSquare, Smartphone, AlertTriangle,
  CheckCircle2, XCircle, Clock, Loader2, ServerCog,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@evoapi/design-system';
import BaseStatsCard from '@/components/base/BaseStatsCard';
import BarChartCard from '@/components/charts/BarChartCard';
import DonutChartCard from '@/components/charts/DonutChartCard';
import clientInstancesService, {
  MonitoringData, MonitoringTenant, MonitoringWhatsapp,
} from '@/services/clientInstances/clientInstancesService';
import AutomationsSection from './AutomationsSection';

const DONUT_COLORS = ['#7c3aed', '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899'];

function channelOff(w: MonitoringWhatsapp): boolean {
  const c = w.connection as Record<string, unknown> | null;
  if (!c || typeof c !== 'object') return false;
  return c['connection'] === 'disconnected' || !!c['error'];
}

function ageLabel(mins: number | null): string {
  if (mins === null || mins === undefined) return 'sem registro';
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Monitoring() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientInstancesService.monitoring();
      setData(res.data.data);
      setUpdatedAt(new Date());
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'Acesso restrito ao super-admin.' : 'Não foi possível carregar o monitoramento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const ov = data?.overview;
  const tenants = data?.tenants ?? [];
  const totalInbound = ov?.total_inbound_24h ?? 0;

  const barData = tenants.map((t) => ({ name: t.name.replace(/\(.*\)/, '').trim(), value: t.inbound_24h }));
  const donutData = totalInbound > 0
    ? tenants
        .filter((t) => t.inbound_24h > 0)
        .map((t, i) => ({
          name: t.name.replace(/\(.*\)/, '').trim(),
          value: Math.round((t.inbound_24h / totalInbound) * 100),
          color: DONUT_COLORS[i % DONUT_COLORS.length],
        }))
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Monitoramento</h1>
            <p className="text-sm text-muted-foreground">
              Saúde de todos os CRMs em tempo real
              {updatedAt && ` · atualizado ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!data && loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BaseStatsCard
              title="Clientes online"
              value={`${ov?.online ?? 0}/${ov?.total ?? 0}`}
              icon={ServerCog}
              color={(ov?.online ?? 0) === (ov?.total ?? 0) ? 'green' : 'red'}
              valueFormat="custom"
            />
            <BaseStatsCard
              title="Leads (24h)"
              value={totalInbound}
              icon={MessageSquare}
              color="purple"
            />
            <BaseStatsCard
              title="Canais conectados"
              value={`${(ov?.channels_total ?? 0) - (ov?.channels_off ?? 0)}/${ov?.channels_total ?? 0}`}
              icon={Smartphone}
              color={(ov?.channels_off ?? 0) > 0 ? 'orange' : 'blue'}
              valueFormat="custom"
            />
            <BaseStatsCard
              title="Alertas"
              value={ov?.alerts ?? 0}
              icon={AlertTriangle}
              color={(ov?.alerts ?? 0) > 0 ? 'red' : 'gray'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartCard
              title="Leads nas últimas 24h"
              description="Mensagens recebidas por cliente"
              data={barData}
              icon={MessageSquare}
              gradientFrom="#7c3aed"
              gradientTo="#a855f7"
              color="#7c3aed"
            />
            {donutData.length > 0 ? (
              <DonutChartCard
                title="Distribuição de leads"
                description="Participação de cada cliente nas últimas 24h"
                data={donutData}
                icon={Activity}
                gradientFrom="#7c3aed"
                gradientTo="#a855f7"
                centerLabel="Total 24h"
                centerValue={String(totalInbound)}
              />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Distribuição de leads</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Nenhum lead nas últimas 24h
                </CardContent>
              </Card>
            )}
          </div>

          {/* Status por cliente */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <ServerCog className="h-5 w-5 text-[#7c3aed]" /> Status por cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="divide-y divide-border">
                {tenants.map((t: MonitoringTenant) => {
                  const offChannels = t.whatsapp.filter(channelOff);
                  return (
                    <div key={t.backend_url} className="py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="flex items-center gap-2 md:w-64">
                        {t.online
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className="font-medium text-foreground truncate">{t.name}</span>
                        {t.master && <Badge variant="secondary" className="text-[10px]">raiz</Badge>}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground flex-1">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> última msg {ageLabel(t.minutes_since_last_inbound)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> {t.inbound_24h} em 24h
                        </span>
                        {!t.api_up && <Badge className="bg-red-100 text-red-700 text-[10px]">API fora</Badge>}
                        {t.reauth_required && <Badge className="bg-orange-100 text-orange-700 text-[10px]">reautorizar</Badge>}
                      </div>

                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {t.whatsapp.length === 0 && (
                          <span className="text-xs text-muted-foreground">sem canal</span>
                        )}
                        {t.whatsapp.map((w, i) => {
                          const off = channelOff(w);
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                off
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              }`}
                              title={off ? 'WhatsApp desconectado' : 'WhatsApp conectado'}
                            >
                              <Smartphone className="h-3 w-3" />
                              {w.inbox || w.provider}
                            </span>
                          );
                        })}
                      </div>

                      {offChannels.length > 0 && (
                        <span className="text-[11px] text-red-600 md:hidden">
                          {offChannels.length} canal(is) desconectado(s)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Automações externas (n8n + Make) por cliente */}
          <AutomationsSection />
        </>
      )}
    </div>
  );
}
