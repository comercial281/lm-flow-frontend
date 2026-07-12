import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone,
  ShieldCheck,
  Layers,
  ListOrdered,
  BarChart3,
  Plus,
  Loader2,
  Radio,
  ExternalLink,
  Pause,
  Play,
  Ban,
} from 'lucide-react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import {
  broadcastsService,
  BroadcastCampaign,
  CloudChannelOption,
  CloudMetrics,
} from '@/services/broadcasts/broadcastsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { messageFunnelsService } from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel } from '@/types/messageFunnels';
import type { PipelineStage } from '@/types/analytics';
import MessageTemplateForm from '@/components/channels/settings/MessageTemplateForm';
import BulkDispatchModal from '@/components/pipelines/BulkDispatchModal';

type Tab = 'disparos' | 'templates' | 'canais' | 'cadencias' | 'metricas';

const STATUS_META: Record<BroadcastCampaign['status'], { label: string; cls: string }> = {
  running: { label: 'Enviando', cls: 'bg-primary/15 text-primary border-primary/40' },
  paused: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const TABS: { id: Tab; label: string; icon: typeof Megaphone }[] = [
  { id: 'disparos', label: 'Disparos', icon: Megaphone },
  { id: 'templates', label: 'Templates', icon: ShieldCheck },
  { id: 'canais', label: 'Canais oficiais', icon: Layers },
  { id: 'cadencias', label: 'Cadências', icon: ListOrdered },
  { id: 'metricas', label: 'Métricas', icon: BarChart3 },
];

export default function Disparos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('disparos');

  // Canais oficiais (WhatsApp Cloud)
  const [channels, setChannels] = useState<CloudChannelOption[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Aba Disparos
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Aba Templates
  const [tplInboxId, setTplInboxId] = useState('');

  // Aba Cadências
  const [funnels, setFunnels] = useState<MessageFunnel[]>([]);

  // Aba Métricas
  const [metrics, setMetrics] = useState<CloudMetrics | null>(null);
  const [metricsDays, setMetricsDays] = useState(30);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const loadMetrics = useCallback((days: number) => {
    setLoadingMetrics(true);
    broadcastsService
      .whatsappCloudMetrics(days)
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoadingMetrics(false));
  }, []);

  useEffect(() => {
    if (tab === 'metricas') loadMetrics(metricsDays);
  }, [tab, metricsDays, loadMetrics]);

  useEffect(() => {
    broadcastsService
      .whatsappCloudOptions()
      .then(c => {
        setChannels(c);
        if (c[0]) setTplInboxId(c[0].inbox_id);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoadingChannels(false));

    pipelinesService
      .getPipelines()
      .then(r => {
        const list = (r?.data ?? []) as { id: string; name: string }[];
        setPipelines(list.map(p => ({ id: p.id, name: p.name })));
        if (list[0]) setPipelineId(list[0].id);
      })
      .catch(() => setPipelines([]));

    messageFunnelsService
      .list({ activeOnly: true })
      .then(setFunnels)
      .catch(() => setFunnels([]));
  }, []);

  const loadCampaigns = useCallback((pid: string) => {
    if (!pid) {
      setCampaigns([]);
      return;
    }
    broadcastsService.list(pid).then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (!pipelineId) {
      setStages([]);
      setCampaigns([]);
      return;
    }
    pipelinesService
      .getPipeline(pipelineId)
      .then(p => setStages(p.stages || []))
      .catch(() => setStages([]));
    loadCampaigns(pipelineId);
  }, [pipelineId, loadCampaigns]);

  const setStatus = async (c: BroadcastCampaign, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'cancel' && !window.confirm('Cancelar este disparo? As mensagens ainda não enviadas não sairão.')) return;
      const fn = action === 'pause' ? broadcastsService.pause : action === 'resume' ? broadcastsService.resume : broadcastsService.cancel;
      await fn.call(broadcastsService, c.id);
      loadCampaigns(pipelineId);
    } catch {
      toast.error('Não consegui atualizar o disparo.');
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === pipelineId);
  const selectedTplChannel = channels.find(o => o.inbox_id === tplInboxId) || channels[0];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Disparos</h1>
          <p className="text-sm text-muted-foreground">
            Disparo em massa por WhatsApp — Evolution ou oficial (Cloud API), templates e cadências.
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(tItem => {
          const Icon = tItem.icon;
          const active = tab === tItem.id;
          return (
            <button
              key={tItem.id}
              type="button"
              onClick={() => setTab(tItem.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tItem.label}
            </button>
          );
        })}
      </div>

      {/* ===================== DISPAROS ===================== */}
      {tab === 'disparos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[240px]">
              <label className="text-sm text-muted-foreground">Pipeline</label>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setModalOpen(true)} disabled={!pipelineId}>
              <Plus className="w-4 h-4 mr-1" /> Novo disparo
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum disparo neste pipeline ainda. Clique em "Novo disparo" pra criar o primeiro.
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => {
                const meta = STATUS_META[c.status];
                const done = c.sent_count + c.failed_count + c.skipped_count;
                const pct = c.total_count ? Math.round((done / c.total_count) * 100) : 0;
                return (
                  <div key={c.id} className="border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.sent_count} enviadas · {c.failed_count} falhas · {c.total_count} no total
                        </div>
                        {(c.delivered_count != null || c.read_count != null || c.replied_count != null) && (
                          <div className="text-xs text-muted-foreground">
                            {c.delivered_count ?? 0} entregues · {c.read_count ?? 0} lidas · <span className="text-foreground font-medium">{c.replied_count ?? 0} responderam</span>
                          </div>
                        )}
                      </div>
                      <Badge className={`text-xs border ${meta.cls}`}>{meta.label}</Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-1.5 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {(c.status === 'running' || c.status === 'paused') && (
                      <div className="flex items-center gap-2 pt-1">
                        {c.status === 'running' ? (
                          <Button variant="outline" size="sm" onClick={() => setStatus(c, 'pause')}>
                            <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setStatus(c, 'resume')}>
                            <Play className="w-3.5 h-3.5 mr-1" /> Retomar
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setStatus(c, 'cancel')}>
                          <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pipelineId && (
            <BulkDispatchModal
              open={modalOpen}
              onOpenChange={o => {
                setModalOpen(o);
                if (!o) loadCampaigns(pipelineId);
              }}
              pipelineId={pipelineId}
              pipelineName={selectedPipeline?.name}
              stages={stages}
            />
          )}
        </div>
      )}

      {/* ===================== TEMPLATES ===================== */}
      {tab === 'templates' && (
        <div className="space-y-4">
          {loadingChannels ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando canais...
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum canal WhatsApp Oficial conectado. Templates são criados e aprovados por número oficial (Cloud API).
              </p>
              <Button variant="outline" onClick={() => navigate('/channels')}>
                <Plus className="w-4 h-4 mr-1" /> Conectar canal oficial
              </Button>
            </div>
          ) : (
            <>
              {channels.length > 1 && (
                <div className="space-y-1.5 max-w-sm">
                  <label className="text-sm text-muted-foreground">Número (canal oficial)</label>
                  <Select value={selectedTplChannel?.inbox_id ?? ''} onValueChange={setTplInboxId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map(o => (
                        <SelectItem key={o.inbox_id} value={o.inbox_id}>
                          {o.name} · {o.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Crie o template, submeta pra Meta e acompanhe o status (a Meta é quem aprova). O nome do template não pode
                ser alterado depois de criado — pra "renomear", duplique com um nome novo.
              </p>
              {selectedTplChannel && (
                <MessageTemplateForm
                  inboxId={selectedTplChannel.inbox_id}
                  channelType="Channel::Whatsapp"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ===================== CANAIS OFICIAIS ===================== */}
      {tab === 'canais' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Números oficiais (WhatsApp Cloud API) conectados ao LM Flow.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/channels')}>
              <Plus className="w-4 h-4 mr-1" /> Conectar número
            </Button>
          </div>
          {loadingChannels ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum canal oficial conectado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map(o => {
                const approved = o.templates.filter(t => t.approved).length;
                return (
                  <div key={o.inbox_id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Radio className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{o.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.phone_number} · {approved} template(s) aprovado(s) de {o.templates.length}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/channels`)}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Gerenciar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== CADÊNCIAS ===================== */}
      {tab === 'cadencias' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cadências são sequências de mensagens (com delay entre passos) que você monta dentro de um disparo (modo
            sequência) e salva como modelo reutilizável aqui.
          </p>
          {funnels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Nenhum modelo de cadência salvo ainda.</p>
              <Button variant="outline" onClick={() => setTab('disparos')}>
                <Plus className="w-4 h-4 mr-1" /> Montar no Novo disparo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {funnels.map(f => (
                <div key={f.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <ListOrdered className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(f.items?.length ?? 0)} passo(s)
                        {f.category ? ` · ${f.category}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== MÉTRICAS ===================== */}
      {tab === 'metricas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground max-w-xl">
              Enviadas, entregues e <strong>custo real</strong> (dados da Meta) por número oficial. A fatura/cobrança
              fica no billing da Meta Business — aqui é o acompanhamento.
            </p>
            <Select value={String(metricsDays)} onValueChange={v => setMetricsDays(Number(v))}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingMetrics ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando métricas...
            </div>
          ) : !metrics || metrics.channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum número oficial conectado ainda, ou sem envios no período.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-muted-foreground">Enviadas</div>
                  <div className="text-2xl font-semibold">{metrics.totals.sent}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-muted-foreground">Entregues</div>
                  <div className="text-2xl font-semibold">
                    {metrics.totals.delivered}
                    {metrics.totals.sent > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round((metrics.totals.delivered / metrics.totals.sent) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-muted-foreground">Custo (Meta, US$)</div>
                  <div className="text-2xl font-semibold">
                    {metrics.totals.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {metrics.channels.map(c => {
                  const q = c.quality_rating?.toLowerCase();
                  const qClr =
                    q === 'green' ? 'text-green-600' : q === 'yellow' ? 'text-amber-600' : q === 'red' ? 'text-red-600' : 'text-muted-foreground';
                  return (
                    <div key={c.inbox_id} className="border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone_number}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={qClr}>● {c.quality_rating || 'sem dado'}</span>
                          {c.messaging_tier != null && <span className="text-muted-foreground">tier {c.messaging_tier}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs block">Enviadas</span>
                          <strong>{c.totals.sent}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Entregues</span>
                          <strong>{c.totals.delivered}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Custo</span>
                          <strong>{c.totals.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}</strong>
                        </div>
                      </div>
                      {Object.keys(c.templates_by_category).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Object.entries(c.templates_by_category).map(([cat, n]) => (
                            <Badge key={cat} className="text-[11px] border bg-muted text-muted-foreground">
                              {cat}: {n}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Entregue/lido/<strong>respondido por disparo</strong> e custo por template vêm na próxima fase
                (reconciliação dos webhooks de status da Meta).
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
