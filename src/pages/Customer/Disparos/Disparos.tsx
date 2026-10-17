import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagina, BaseHeader } from '@/components/base';
import Abas from '@/components/base/Abas';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import {
  Megaphone,
  ShieldCheck,
  Layers,
  ListOrdered,
  BarChart3,
  Plus,
  ExternalLink,
  Pause,
  Play,
  Ban,
} from 'lucide-react';
import {
  Card,
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
} from '@/services/broadcasts/broadcastsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { funnelMessageCount } from '@/features/flowAutomations/conversationFunnelDraft';
import type { PipelineStage } from '@/types/analytics';
import {
  MetricasOficiais,
  ModelosOficiais,
  NumerosOficiais,
  SemNumeroOficial,
  useNumerosOficiais,
} from '@/pages/Customer/Settings/Integrations/WhatsappOficialPartes';
import BulkDispatchModal from '@/components/pipelines/BulkDispatchModal';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { useCan } from '@/hooks/useCan';

import { useConfirmacao } from '@/hooks/useConfirmacao';
import { plural } from '@/lib/formato';
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
  { id: 'cadencias', label: 'Funis', icon: ListOrdered },
  { id: 'metricas', label: 'Métricas', icon: BarChart3 },
];

export default function Disparos() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const navigate = useNavigate();
  const pode = useCan();
  const [tab, setTab] = useState<Tab>('disparos');
  const [recusado, setRecusado] = useState(false);

  // Números oficiais (WhatsApp Cloud). Canais e funis carregam em separado: o erro de um não apaga o que o outro trouxe.
  const { numeros: channels, carregando: loadingChannels, erro: erroCanais, carregar: carregarCanais } = useNumerosOficiais();

  // Aba Disparos
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  // Falha na leitura não vira "Nenhum disparo neste funil ainda".
  const [erroDisparos, setErroDisparos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Aba Funis (05/10/2026): os funis de conversa de Funis de mensagem.
  const [funnels, setFunnels] = useState<FlowAutomation[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(true);
  const [erroFunis, setErroFunis] = useState(false);
  const ultimaCargaFunis = useRef(0);

  const carregarFunis = useCallback(() => {
    const vez = ++ultimaCargaFunis.current;
    setLoadingFunnels(true);
    setErroFunis(false);
    flowAutomationsService
      .list({ kind: 'conversation' })
      .then(list => {
        if (vez !== ultimaCargaFunis.current) return;
        setFunnels((Array.isArray(list) ? list : []).filter(f => !f.archived_at));
      })
      .catch(() => {
        if (vez !== ultimaCargaFunis.current) return;
        setFunnels([]);
        setErroFunis(true);
      })
      .finally(() => { if (vez === ultimaCargaFunis.current) setLoadingFunnels(false); });
  }, []);

  useEffect(() => {
    carregarFunis();

    pipelinesService
      .getPipelines({ include_items: false })
      .then(r => {
        const list = (r?.data ?? []) as { id: string; name: string }[];
        setPipelines(list.map(p => ({ id: p.id, name: p.name })));
        if (list[0]) setPipelineId(list[0].id);
      })
      .catch(() => setPipelines([]));
  }, [carregarFunis]);

  const loadCampaigns = useCallback((pid: string) => {
    if (!pid) {
      setCampaigns([]);
      setErroDisparos(false);
      return;
    }
    broadcastsService.list(pid).then(list => { setCampaigns(list); setRecusado(false); setErroDisparos(false); }).catch(e => {
      setCampaigns([]);
      if (isForbiddenError(e)) setRecusado(true);
      else setErroDisparos(true);
    });
  }, []);

  useEffect(() => {
    if (!pipelineId) {
      setStages([]);
      setCampaigns([]);
      return;
    }
    pipelinesService
      // Só o nome das etapas: o funil inteiro (com todos os cards) é pesado.
      .getPipelineStages(pipelineId)
      .then(r => setStages(r.data || []))
      .catch(() => setStages([]));
    loadCampaigns(pipelineId);
  }, [pipelineId, loadCampaigns]);

  const setStatus = async (c: BroadcastCampaign, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'cancel' && !(await confirmar({
        titulo: 'Cancelar disparo',
        descricao: 'As mensagens ainda não enviadas não sairão.',
        rotuloDaAcao: 'Cancelar disparo',
        rotuloDeCancelar: 'Voltar',
        destrutivo: true,
      }))) return;
      const fn = action === 'pause' ? broadcastsService.pause : action === 'resume' ? broadcastsService.resume : broadcastsService.cancel;
      await fn.call(broadcastsService, c.id);
      loadCampaigns(pipelineId);
    } catch {
      toast.error('Não consegui atualizar o disparo.');
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === pipelineId);

  if (recusado) return <NoAccessState />;

  return (
    <>
    <Pagina
      cabecalho={
        <BaseHeader
          title="Disparos"
          subtitle="Disparo em massa por WhatsApp — por QR code ou número oficial, templates e cadências."
        />
      }
    >
      {/* Abas */}
      <Abas
        rotulo="Partes de Disparos"
        ativa={tab}
        aoTrocar={chave => setTab(chave as Tab)}
        abas={TABS.map(t => ({ chave: t.id, rotulo: t.label, icone: t.icon }))}
      />

      {/* ===================== DISPAROS ===================== */}
      {tab === 'disparos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[240px]">
              <label className="text-sm text-muted-foreground">Funil</label>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher funil" />
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
            {pode('broadcasts', 'create') && (
              <Button onClick={() => setModalOpen(true)} disabled={!pipelineId}>
                <Plus className="w-4 h-4 mr-1" /> Novo disparo
              </Button>
            )}
          </div>

          {campaigns.length === 0 && erroDisparos ? (
            <EmptyState tipo="erro" aoTentarDeNovo={() => loadCampaigns(pipelineId)} />
          ) : campaigns.length === 0 ? (
            <EmptyState
              title="Nenhum disparo neste funil ainda."
              description='Clique em "Novo disparo" pra criar o primeiro.'
            />
          ) : (
            <>
              {/* KPIs — agregado real das campanhas */}
              {(() => {
                const agg = campaigns.reduce((a, c) => ({
                  sent: a.sent + c.sent_count,
                  delivered: a.delivered + (c.delivered_count ?? 0),
                  replied: a.replied + (c.replied_count ?? 0),
                }), { sent: 0, delivered: 0, replied: 0 });
                const kpis = [
                  { label: 'Campanhas', value: campaigns.length, color: 'text-violet-400', tint: 'rgba(124,58,237,0.14)' },
                  { label: 'Enviadas', value: agg.sent, color: 'text-blue-400', tint: 'rgba(59,130,246,0.14)' },
                  { label: 'Entregues', value: agg.delivered, color: 'text-emerald-400', tint: 'rgba(16,185,129,0.14)' },
                  { label: 'Respostas', value: agg.replied, color: 'text-fuchsia-400', tint: 'rgba(217,70,239,0.14)' },
                ];
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {kpis.map(k => (
                      <Card key={k.label} className="relative gap-0 overflow-hidden p-4">
                        <div aria-hidden className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl" style={{ background: k.tint }} />
                        <p className="relative text-xs font-medium text-muted-foreground">{k.label}</p>
                        <p className={`relative text-2xl font-bold tracking-tight mt-1 ${k.color}`}>{k.value.toLocaleString('pt-BR')}</p>
                      </Card>
                    ))}
                  </div>
                );
              })()}

              {/* Tabela de campanhas — estilo protótipo */}
              <Card className="gap-0 overflow-hidden py-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="font-medium px-4 py-3">Campanha</th>
                        <th className="font-medium px-4 py-3">Enviadas</th>
                        <th className="font-medium px-4 py-3">Entregues</th>
                        <th className="font-medium px-4 py-3">Respostas</th>
                        <th className="font-medium px-4 py-3 min-w-[140px]">Progresso</th>
                        <th className="font-medium px-4 py-3">Status</th>
                        <th className="font-medium px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => {
                        const meta = STATUS_META[c.status];
                        const done = c.sent_count + c.failed_count + c.skipped_count;
                        const pct = c.total_count ? Math.round((done / c.total_count) * 100) : 0;
                        return (
                          <tr key={c.id} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium max-w-[220px] truncate" title={c.name}>{c.name}</td>
                            <td className="px-4 py-3 tabular-nums">{c.sent_count}</td>
                            <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.delivered_count ?? 0}</td>
                            <td className="px-4 py-3 tabular-nums font-medium">{c.replied_count ?? 0}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-full min-w-[70px] overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge className={`text-xs border ${meta.cls}`}>{meta.label}</Badge></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {(c.status === 'running' || c.status === 'paused') && (
                                  <>
                                    {c.status === 'running' ? (
                                      pode('broadcasts', 'pause') && (
                                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatus(c, 'pause')}>
                                          <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
                                        </Button>
                                      )
                                    ) : (
                                      pode('broadcasts', 'resume') && (
                                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatus(c, 'resume')}>
                                          <Play className="w-3.5 h-3.5 mr-1" /> Retomar
                                        </Button>
                                      )
                                    )}
                                    {pode('broadcasts', 'cancel') && (
                                      <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setStatus(c, 'cancel')}>
                                        <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
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

      {/* ===================== MODELOS / NÚMEROS OFICIAIS (F6: agora também em Integrações) ===================== */}
      {(tab === 'templates' || tab === 'canais') && (
        loadingChannels ? (
          <Carregando variante="texto" linhas={4} rotulo="Carregando números..." />
        ) : erroCanais ? (
          <EmptyState tipo="erro" aoTentarDeNovo={carregarCanais} />
        ) : channels.length === 0 ? (
          <SemNumeroOficial />
        ) : tab === 'templates' ? (
          <ModelosOficiais numeros={channels} />
        ) : (
          <NumerosOficiais numeros={channels} />
        )
      )}

      {/* ===================== FUNIS ===================== */}
      {/* Desde 05/10/2026 a biblioteca é a de Funis de mensagem (funis de
          conversa). No Novo disparo, "Usar funil" carrega um deles na sequência. */}
      {tab === 'cadencias' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Os funis ficam em <strong>Funis de mensagem</strong>. No Novo disparo, use <strong>Usar funil</strong> pra
            carregar um deles na sequência de mensagens.
          </p>
          {loadingFunnels ? (
            <Carregando rotulo="Carregando os funis…" />
          ) : erroFunis ? (
            <EmptyState tipo="erro" aoTentarDeNovo={carregarFunis} />
          ) : funnels.length === 0 ? (
            <EmptyState
              title="Nenhum funil ainda."
              action={{ label: 'Novo funil', onClick: () => navigate(FLOW_KIND_COPY.conversation.listPath), variant: 'outline' }}
            />
          ) : (
            <div className="space-y-2">
              {funnels.map(f => {
                const count = funnelMessageCount(f);
                return (
                  <div key={f.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <ListOrdered className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{f.name}</span>
                          {f.team && <Badge variant="secondary" className="shrink-0">Da equipe</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            count != null ? plural(count, 'mensagem', 'mensagens') : null,
                            f.guide_done === false ? 'falta terminar o passo a passo' : f.is_enabled ? null : 'desligado',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`${FLOW_KIND_COPY.conversation.listPath}/${f.id}`)}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir em Funis de mensagem
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== MÉTRICAS ===================== */}
      {tab === 'metricas' && <MetricasOficiais />}
    </Pagina>
      {dialogoDeConfirmacao}
    </>
  );
}
