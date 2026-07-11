import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@/components/ui/ds';
import {
  Megaphone,
  Users,
  MessageSquareText,
  Clock,
  ListChecks,
  Loader2,
  CheckCircle2,
  Pause,
  Play,
  Ban,
  ChevronLeft,
  Send,
  Paperclip,
  Save,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { PipelineStage } from '@/types/analytics';
import {
  broadcastsService,
  BroadcastCampaign,
  BroadcastSequenceItem,
  AudienceMode,
  BroadcastChannelKind,
  BroadcastTemplateConfig,
  CloudChannelOption,
} from '@/services/broadcasts/broadcastsService';
import { labelsService } from '@/services/contacts/labelsService';
import type { Label as LabelType } from '@/types/settings';
import {
  messageFunnelsService,
  tenantTemplateVariablesService,
} from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel, MessageFunnelItem, TemplateVariable } from '@/types/messageFunnels';
import MessageSequenceEditor, {
  type SequenceDraftItem,
  newSequenceItem,
} from '@/components/messaging/MessageSequenceEditor';

interface BulkDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  pipelineName?: string;
  stages: PipelineStage[];
}

type Step = 'audience' | 'messages' | 'cadence' | 'review' | 'creating' | 'done';
type View = 'new' | 'list';

const STATUS_META: Record<BroadcastCampaign['status'], { label: string; cls: string }> = {
  running: { label: 'Enviando', cls: 'bg-primary/15 text-primary border-primary/40' },
  paused: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const KIND_LABEL: Record<SequenceDraftItem['kind'], string> = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  document: 'Documento',
  delay: 'Aguardar',
};

// Preview substituindo {{nome}} por um exemplo só na revisão.
function preview(text: string, name = 'Giovani') {
  return text.replace(/\{\{?\s*nome\s*\}?\}/gi, name);
}

function itemIsValid(it: SequenceDraftItem) {
  if (it.kind === 'delay') return true; // item de espera é sempre válido
  return it.kind === 'text' ? (it.text_content ?? '').trim() !== '' : !!it.media_url;
}

// Converte os itens do editor no payload de sequência do backend.
function toSequencePayload(items: SequenceDraftItem[]): BroadcastSequenceItem[] {
  return items.map((it, idx) => {
    const variations = (it.text_variations ?? []).map(s => s.trim()).filter(Boolean);
    return {
      position: idx,
      kind: it.kind,
      text_content: it.text_content,
      ...(variations.length ? { text_variations: variations } : {}),
      media_url: it.media_url,
      media_caption: it.media_caption,
      media_filename: it.media_filename,
      delay_seconds: it.delay_seconds,
    };
  });
}

// Item de funil salvo → item do editor (mesmo mapeamento do agendar/funil).
function draftFromFunnelItem(it: MessageFunnelItem): SequenceDraftItem {
  return {
    uiKey: crypto.randomUUID(),
    kind: it.kind,
    text_content: it.text_content,
    media_url: it.media_url,
    media_filename: it.media_filename,
    media_caption: it.media_caption,
    delay_seconds: it.delay_seconds,
    pendingFile: null,
  };
}

export default function BulkDispatchModal({
  open,
  onOpenChange,
  pipelineId,
  pipelineName,
  stages,
}: BulkDispatchModalProps) {
  const [view, setView] = useState<View>('new');
  const [step, setStep] = useState<Step>('audience');

  // Audiência
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('pipeline');
  const [stageId, setStageId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countingAudience, setCountingAudience] = useState(false);

  // Mensagem (sequência multi-item — MESMO editor do funil)
  const [items, setItems] = useState<SequenceDraftItem[]>([newSequenceItem()]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [funnelTemplates, setFunnelTemplates] = useState<MessageFunnel[]>([]);

  // Canal do disparo: 'evolution' (sessão livre) ou 'whatsapp_cloud' (template oficial).
  const [channelKind, setChannelKind] = useState<BroadcastChannelKind>('evolution');
  const [cloudOptions, setCloudOptions] = useState<CloudChannelOption[]>([]);
  const [cloudInboxId, setCloudInboxId] = useState('');
  const [cloudTemplateName, setCloudTemplateName] = useState('');
  const [cloudVars, setCloudVars] = useState<Record<string, string>>({});

  // Nome do envio (vai pro registro/LOG e pra lista de disparos)
  const [campaignName, setCampaignName] = useState('');

  // Destino pós-envio (opcional): mover pra etapa + criar/aplicar tag
  const [postStageId, setPostStageId] = useState('');
  const [postLabel, setPostLabel] = useState('');

  // Cadência
  const [minS, setMinS] = useState(4);
  const [maxS, setMaxS] = useState(8);
  const [batchSize, setBatchSize] = useState(10);
  const [pauseS, setPauseS] = useState(60);
  const [businessHours, setBusinessHours] = useState(true);

  // Teste
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  // Acompanhamento
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [creating, setCreating] = useState(false);

  const resetWizard = useCallback(() => {
    setStep('audience');
    setAudienceMode('pipeline');
    setStageId('');
    setSelectedLabels([]);
    setRecipientCount(null);
    setItems([newSequenceItem()]);
    setChannelKind('evolution');
    setCloudInboxId('');
    setCloudTemplateName('');
    setCloudVars({});
    setCampaignName('');
    setPostStageId('');
    setPostLabel('');
    setMinS(4);
    setMaxS(8);
    setBatchSize(10);
    setPauseS(60);
    setBusinessHours(true);
    setTestPhone('');
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await broadcastsService.list(pipelineId);
      setCampaigns(list);
      return list;
    } catch {
      setCampaigns([]);
      return [];
    }
  }, [pipelineId]);

  // Ao abrir: carrega campanhas + variáveis do tenant e decide a view inicial.
  useEffect(() => {
    if (!open) return;
    resetWizard();
    refreshList().then(list => {
      const hasActive = list.some(c => c.status === 'running' || c.status === 'paused');
      setView(hasActive ? 'list' : 'new');
    });
    labelsService
      .getLabels()
      .then(res => setAvailableLabels(Array.isArray(res.data) ? (res.data as LabelType[]) : []))
      .catch(() => setAvailableLabels([]));
    tenantTemplateVariablesService
      .list()
      .then(res => {
        setVariables([
          ...res.builtin,
          ...res.custom.map(v => ({
            token: v.token,
            placeholder: v.placeholder,
            label: v.label,
            description: v.description,
            builtin: false,
          })),
        ]);
      })
      .catch(() =>
        setVariables([
          { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
          { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
          { token: 'email', placeholder: '{{email}}', label: 'E-mail', builtin: true },
        ]),
      );
    messageFunnelsService
      .list({ activeOnly: true })
      .then(setFunnelTemplates)
      .catch(() => setFunnelTemplates([]));
    broadcastsService
      .whatsappCloudOptions()
      .then(setCloudOptions)
      .catch(() => setCloudOptions([]));
  }, [open, refreshList, resetWizard]);

  // Carrega um modelo salvo (funil) na sequência atual.
  const loadTemplate = async (funnelId: string) => {
    try {
      const funnel = await messageFunnelsService.get(funnelId);
      setItems(funnel.items.length ? funnel.items.map(draftFromFunnelItem) : [newSequenceItem()]);
      toast.success(`Modelo "${funnel.name}" carregado`);
    } catch {
      toast.error('Não consegui carregar o modelo.');
    }
  };

  // Salva a sequência atual como modelo reutilizável na biblioteca (funil compartilhado).
  const saveAsTemplate = async () => {
    const valid = items.filter(itemIsValid);
    if (!valid.length) {
      toast.error('Monte a sequência antes de salvar o modelo.');
      return;
    }
    const name = window.prompt('Nome do modelo:')?.trim();
    if (!name) return;
    try {
      await messageFunnelsService.create({
        name,
        category: 'geral',
        active: true,
        shared: true,
        items: toSequencePayload(valid).map((it, idx) => ({
          position: idx,
          kind: it.kind,
          text_content: it.text_content,
          media_caption: it.media_caption,
          media_filename: it.media_filename,
          delay_seconds: it.delay_seconds,
        })),
      });
      toast.success('Modelo salvo na biblioteca.');
      setFunnelTemplates(await messageFunnelsService.list({ activeOnly: true }));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui salvar o modelo.'));
    }
  };

  // Conta destinatários quando a audiência muda (só na view de criação).
  const audiencePayload = useMemo(
    () => ({
      mode: audienceMode,
      stage_id: audienceMode === 'stage' ? stageId : undefined,
      labels: audienceMode === 'tag' ? selectedLabels : undefined,
    }),
    [audienceMode, stageId, selectedLabels],
  );
  useEffect(() => {
    if (!open || view !== 'new') return;
    if (audienceMode === 'stage' && !stageId) {
      setRecipientCount(null);
      return;
    }
    if (audienceMode === 'tag' && selectedLabels.length === 0) {
      setRecipientCount(null);
      return;
    }
    let alive = true;
    setCountingAudience(true);
    broadcastsService
      .audiencePreview(pipelineId, audiencePayload)
      .then(n => alive && setRecipientCount(n))
      .catch(() => alive && setRecipientCount(null))
      .finally(() => alive && setCountingAudience(false));
    return () => {
      alive = false;
    };
  }, [open, view, pipelineId, audienceMode, stageId, audiencePayload]);

  const itemsValid = useMemo(() => items.length > 0 && items.every(itemIsValid), [items]);

  // Canal oficial (WhatsApp Cloud): exige template aprovado + variáveis preenchidas.
  const cloudMode = channelKind === 'whatsapp_cloud';
  const selectedCloudInbox = useMemo(
    () => cloudOptions.find(o => o.inbox_id === cloudInboxId) || cloudOptions[0],
    [cloudOptions, cloudInboxId],
  );
  const selectedCloudTemplate = useMemo(
    () => selectedCloudInbox?.templates.find(t => t.name === cloudTemplateName),
    [selectedCloudInbox, cloudTemplateName],
  );
  const cloudVarsFilled = useMemo(
    () => (selectedCloudTemplate?.variables ?? []).every(v => (cloudVars[v] ?? '').trim() !== ''),
    [selectedCloudTemplate, cloudVars],
  );
  const buildTemplateConfig = useCallback(
    (): BroadcastTemplateConfig => ({
      inbox_id: selectedCloudInbox?.inbox_id,
      template_name: selectedCloudTemplate?.name ?? '',
      language: selectedCloudTemplate?.language,
      parameters: (selectedCloudTemplate?.variables ?? []).map(v => cloudVars[v] ?? ''),
    }),
    [selectedCloudInbox, selectedCloudTemplate, cloudVars],
  );

  const step1Ok = (recipientCount ?? 0) > 0;
  const step2Ok = cloudMode
    ? !!selectedCloudInbox && !!selectedCloudTemplate && !!selectedCloudTemplate.approved && cloudVarsFilled
    : itemsValid;
  const step3Ok = minS >= 2 && maxS >= minS && batchSize >= 1 && batchSize <= 50 && pauseS >= 10;

  const sumItemDelays = useMemo(
    () => items.reduce((acc, it) => acc + (it.delay_seconds || 0), 0),
    [items],
  );

  const estDurationMin = useMemo(() => {
    const n = recipientCount ?? 0;
    if (!n) return 0;
    const avg = (minS + maxS) / 2;
    const pauses = Math.max(0, Math.ceil(n / batchSize) - 1);
    return Math.round((n * (avg + sumItemDelays) + pauses * pauseS) / 60);
  }, [recipientCount, minS, maxS, batchSize, pauseS, sumItemDelays]);

  const handleTest = async () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Número inválido (use DDD + número, ex: 5511999999999).');
      return;
    }
    if (cloudMode) {
      if (!step2Ok) {
        toast.error('Escolha um template aprovado e preencha as variáveis.');
        return;
      }
    } else if (!itemsValid) {
      toast.error('Monte a sequência antes de testar.');
      return;
    }
    setTesting(true);
    try {
      if (cloudMode) {
        await broadcastsService.testSendTemplate(phone, buildTemplateConfig());
      } else {
        await broadcastsService.testSendSequence(phone, toSequencePayload(items));
      }
      toast.success('Teste enviado! Confere o WhatsApp.');
    } catch (err: any) {
      toast.error(err?.response?.data?.errors?.[0] || 'Falha ao enviar o teste.');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (step === 'creating') return;
    onOpenChange(v);
  };

  const handleCreate = async () => {
    setCreating(true);
    setStep('creating');
    try {
      await broadcastsService.create({
        name: campaignName.trim() || undefined,
        pipeline_id: pipelineId,
        channel_kind: channelKind,
        template_config: cloudMode ? buildTemplateConfig() : undefined,
        audience: {
          mode: audienceMode,
          stage_id: audienceMode === 'stage' ? stageId : undefined,
          labels: audienceMode === 'tag' ? selectedLabels : undefined,
        },
        funnel_items: cloudMode ? undefined : toSequencePayload(items),
        post_send:
          postStageId || postLabel.trim()
            ? { stage_id: postStageId || undefined, label: postLabel.trim() || undefined }
            : undefined,
        min_interval_seconds: minS,
        max_interval_seconds: maxS,
        batch_size: batchSize,
        batch_pause_seconds: pauseS,
        business_hours_only: businessHours,
      });
      await refreshList();
      setStep('done');
      toast.success('Disparo criado! Mensagens saindo em lotes.');
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.[0] || err?.message || 'Erro ao criar disparo';
      toast.error(msg);
      setStep('review');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (c: BroadcastCampaign, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'cancel' && !window.confirm('Cancelar este disparo? As mensagens ainda não enviadas não sairão.'))
        return;
      const fn = action === 'pause' ? broadcastsService.pause : action === 'resume' ? broadcastsService.resume : broadcastsService.cancel;
      await fn.call(broadcastsService, c.id);
      await refreshList();
    } catch {
      toast.error('Não consegui atualizar o disparo.');
    }
  };

  const stepIndex = ['audience', 'messages', 'cadence', 'review'].indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Disparo em massa {pipelineName ? `· ${pipelineName}` : ''}
            </DialogTitle>
            <div className="flex items-center gap-1 mr-6">
              <Button
                variant={view === 'new' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setView('new');
                  setStep('audience');
                }}
              >
                Novo
              </Button>
              <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')}>
                Disparos {campaigns.length > 0 && `(${campaigns.length})`}
              </Button>
            </div>
          </div>
          <DialogDescription>
            {view === 'new'
              ? 'Escolha quem recebe, monte a sequência de mensagens, ajuste o ritmo e dispare.'
              : 'Acompanhe, pause, retome ou cancele os disparos deste pipeline.'}
          </DialogDescription>
        </DialogHeader>

        {/* ===================== ACOMPANHAMENTO ===================== */}
        {view === 'list' && (
          <div className="space-y-3 py-2">
            {campaigns.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum disparo ainda. Clique em "Novo" pra criar o primeiro.
              </div>
            )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setStatus(c, 'cancel')}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== WIZARD ===================== */}
        {view === 'new' && (
          <>
            {/* indicador de passos */}
            {step !== 'creating' && step !== 'done' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
                {['Quem recebe', 'Mensagem', 'Ritmo', 'Revisar'].map((lbl, i) => (
                  <span
                    key={lbl}
                    className={`flex items-center gap-1 ${i === stepIndex ? 'text-primary font-medium' : ''}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {lbl}
                    {i < 3 && <span className="mx-1">·</span>}
                  </span>
                ))}
              </div>
            )}

            {/* STEP 1 — Audiência */}
            {step === 'audience' && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Quem vai receber
                  </Label>
                  <Select value={audienceMode} onValueChange={v => setAudienceMode(v as AudienceMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pipeline">Todos os leads do pipeline</SelectItem>
                      <SelectItem value="stage">Uma etapa específica</SelectItem>
                      <SelectItem value="tag">Por etiqueta (tag)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {audienceMode === 'tag' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Etiquetas</Label>
                    {availableLabels.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {availableLabels.map(l => {
                          const active = selectedLabels.includes(l.title);
                          const color = l.color || '#7c3aed';
                          return (
                            <button
                              key={l.title}
                              type="button"
                              onClick={() =>
                                setSelectedLabels(prev =>
                                  prev.includes(l.title) ? prev.filter(t => t !== l.title) : [...prev, l.title],
                                )
                              }
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                                active ? 'text-white' : 'text-foreground hover:bg-muted'
                              }`}
                              style={
                                active
                                  ? { backgroundColor: color, borderColor: color }
                                  : { borderColor: `${color}66` }
                              }
                            >
                              {l.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Recebe quem tem qualquer uma das etiquetas marcadas.
                    </p>
                  </div>
                )}

                {audienceMode === 'stage' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Etapa</Label>
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolher etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  {countingAudience ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Contando destinatários...
                    </>
                  ) : recipientCount === null ? (
                    <span className="text-muted-foreground">
                      {audienceMode === 'tag'
                        ? 'Marque ao menos uma etiqueta pra contar os destinatários.'
                        : 'Escolha a etapa pra contar os destinatários.'}
                    </span>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-primary" />
                      <span>
                        <strong>{recipientCount}</strong> contato(s) com telefone vão receber.
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contatos sem telefone são ignorados automaticamente.
                </p>
              </div>
            )}

            {/* STEP 2 — Mensagem (canal + conteúdo) */}
            {step === 'messages' && (
              <div className="space-y-4 py-2">
                {/* Seletor de canal */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Canal de envio</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChannelKind('evolution')}
                      className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                        !cloudMode ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Zap className={`w-4 h-4 mt-0.5 ${!cloudMode ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm">
                        <span className="font-medium block">Evolution</span>
                        <span className="text-xs text-muted-foreground">Mensagem livre (sequência)</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelKind('whatsapp_cloud')}
                      className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                        cloudMode ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <ShieldCheck className={`w-4 h-4 mt-0.5 ${cloudMode ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm">
                        <span className="font-medium block">WhatsApp Oficial</span>
                        <span className="text-xs text-muted-foreground">Template aprovado (Cloud API)</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* ---- Evolution: sequência livre ---- */}
                {!cloudMode && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm flex items-center gap-1.5">
                        <MessageSquareText className="w-4 h-4" /> Sequência de mensagens
                      </Label>
                      <div className="flex items-center gap-2">
                        {funnelTemplates.length > 0 && (
                          <Select value="" onValueChange={loadTemplate}>
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue placeholder="Usar modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              {funnelTemplates.map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={saveAsTemplate}
                          className="h-7 text-xs"
                          title="Salvar a sequência como modelo na biblioteca"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" /> Salvar modelo
                        </Button>
                      </div>
                    </div>

                    <MessageSequenceEditor
                      items={items}
                      onChange={setItems}
                      variables={variables}
                      uploadMedia={broadcastsService.uploadMedia.bind(broadcastsService)}
                      allowTextVariations
                    />

                    <p className="text-xs text-muted-foreground">
                      Use as variáveis pra personalizar (ex: {'{{nome}}'}); a mídia é anexada na hora.
                    </p>
                  </>
                )}

                {/* ---- WhatsApp Oficial: template aprovado ---- */}
                {cloudMode && (
                  <div className="space-y-3">
                    {cloudOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Nenhum canal WhatsApp Oficial conectado. Conecte um número em{' '}
                        <strong>Canais → WhatsApp Oficial</strong> e aprove um template pra disparar por aqui.
                      </div>
                    ) : (
                      <>
                        {cloudOptions.length > 1 && (
                          <div className="space-y-1.5">
                            <Label className="text-sm">Número (canal oficial)</Label>
                            <Select
                              value={selectedCloudInbox?.inbox_id ?? ''}
                              onValueChange={v => {
                                setCloudInboxId(v);
                                setCloudTemplateName('');
                                setCloudVars({});
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Escolher número" />
                              </SelectTrigger>
                              <SelectContent>
                                {cloudOptions.map(o => (
                                  <SelectItem key={o.inbox_id} value={o.inbox_id}>
                                    {o.name} · {o.phone_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-sm flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" /> Template aprovado
                          </Label>
                          {(selectedCloudInbox?.templates.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Esse número não tem template ainda. Crie e aprove um template na Meta primeiro.
                            </p>
                          ) : (
                            <Select
                              value={cloudTemplateName}
                              onValueChange={v => {
                                setCloudTemplateName(v);
                                setCloudVars({});
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Escolher template" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedCloudInbox?.templates.map(t => (
                                  <SelectItem key={`${t.name}_${t.language}`} value={t.name} disabled={!t.approved}>
                                    {t.name} · {t.language}
                                    {!t.approved && ` (${(t.status || 'pendente').toLowerCase()})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {selectedCloudTemplate && (
                          <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                            {selectedCloudTemplate.content}
                          </div>
                        )}

                        {selectedCloudTemplate && selectedCloudTemplate.variables.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Preencha as variáveis do template (use {'{{nome}}'} pra puxar o nome do lead)
                            </Label>
                            {selectedCloudTemplate.variables.map((v, i) => (
                              <div key={v} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-14 shrink-0">{`{{${i + 1}}}`}</span>
                                <Input
                                  value={cloudVars[v] ?? ''}
                                  onChange={e => setCloudVars(prev => ({ ...prev, [v]: e.target.value }))}
                                  placeholder="{{nome}} ou texto fixo"
                                  className="h-9"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Fora da janela de 24h, a Meta só entrega template aprovado. As variáveis são preenchidas por lead.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Cadência */}
            {step === 'cadence' && (
              <div className="space-y-4 py-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Ritmo de envio
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Intervalo mínimo (seg)</Label>
                    <Input
                      type="number"
                      min={2}
                      value={minS}
                      onChange={e => setMinS(Math.max(2, Number(e.target.value) || 2))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Intervalo máximo (seg)</Label>
                    <Input
                      type="number"
                      min={2}
                      value={maxS}
                      onChange={e => setMaxS(Math.max(2, Number(e.target.value) || 2))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mensagens por lote</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={batchSize}
                      onChange={e => setBatchSize(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pausa entre lotes (seg)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={pauseS}
                      onChange={e => setPauseS(Math.max(10, Number(e.target.value) || 10))}
                      className="h-9"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={businessHours}
                    onChange={e => setBusinessHours(e.target.checked)}
                    className="rounded border-border"
                  />
                  Só enviar em horário comercial (seg-sex 08-20h, sáb 09-18h)
                </label>
                {!step3Ok && (
                  <p className="text-xs text-amber-600">
                    Máximo deve ser ≥ mínimo (≥2s), lote entre 1 e 50, pausa ≥ 10s.
                  </p>
                )}
                {recipientCount ? (
                  <p className="text-xs text-muted-foreground">
                    Duração estimada: ~{estDurationMin} min pra {recipientCount} contato(s).
                  </p>
                ) : null}
              </div>
            )}

            {/* STEP 4 — Revisão */}
            {step === 'review' && (
              <div className="space-y-3 py-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4" /> Revisar e disparar
                </Label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do envio (aparece no registro/LOG)</Label>
                  <Input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder="Ex: Oferta lançamento — base quente"
                    maxLength={120}
                    className="h-9"
                  />
                </div>

                {/* Após o envio (opcional): mover pra etapa + criar/aplicar tag */}
                <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                  <Label className="text-xs font-medium">Após o envio (opcional)</Label>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Mover quem recebeu para a etapa</Label>
                    <Select value={postStageId || 'none'} onValueChange={v => setPostStageId(v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Não mover" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mover</SelectItem>
                        {stages.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Aplicar tag (cria se não existir)</Label>
                    <Input
                      value={postLabel}
                      onChange={e => setPostLabel(e.target.value)}
                      placeholder="Ex: recebeu-oferta"
                      maxLength={60}
                      className="h-9"
                    />
                    {availableLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {availableLabels.slice(0, 12).map(l => (
                          <button
                            key={l.title}
                            type="button"
                            onClick={() => setPostLabel(l.title)}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
                            style={{ borderColor: `${l.color || '#7c3aed'}66` }}
                          >
                            {l.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Destinatários</span>
                    <strong>{recipientCount}</strong>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Canal</span>
                    <strong>{cloudMode ? 'WhatsApp Oficial (template)' : 'Evolution (sessão)'}</strong>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">{cloudMode ? 'Template' : 'Itens na sequência'}</span>
                    <strong>{cloudMode ? selectedCloudTemplate?.name ?? '—' : items.length}</strong>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Ritmo</span>
                    <strong>
                      {minS}-{maxS}s · lotes de {batchSize} · pausa {pauseS}s
                    </strong>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Horário comercial</span>
                    <strong>{businessHours ? 'Sim' : 'Não'}</strong>
                  </div>
                </div>
                {!cloudMode && (
                  <div className="space-y-2">
                    {items.map((it, i) => (
                      <div key={it.uiKey} className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                        <span className="text-xs text-muted-foreground block mb-1">
                          #{i + 1} · {KIND_LABEL[it.kind]}
                          {it.delay_seconds > 0 && ` · aguarda ${it.delay_seconds}s`}
                          {it.kind === 'text' &&
                            (it.text_variations?.filter(v => v.trim()).length ?? 0) > 0 &&
                            ` · ${(it.text_variations?.filter(v => v.trim()).length ?? 0) + 1} variações (sorteia 1/lead)`}
                        </span>
                        {it.kind !== 'text' && (
                          <span className="text-xs text-primary flex items-center gap-1 mb-1">
                            <Paperclip className="w-3 h-3" /> mídia anexada
                          </span>
                        )}
                        {it.kind === 'text'
                          ? preview(it.text_content ?? '')
                          : it.media_caption
                            ? preview(it.media_caption)
                            : <span className="text-muted-foreground italic">(sem legenda)</span>}
                      </div>
                    ))}
                  </div>
                )}

                {cloudMode && selectedCloudTemplate && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3 h-3" /> Template {selectedCloudTemplate.name} · {selectedCloudTemplate.language}
                    </span>
                    {preview(
                      selectedCloudTemplate.variables.reduce(
                        (txt, v, i) => txt.replace(`{{${i + 1}}}`, cloudVars[v] || `{{${i + 1}}}`),
                        selectedCloudTemplate.content,
                      ),
                    )}
                  </div>
                )}

                {/* Enviar teste pra um número antes de disparar pros leads */}
                <div className="border-t border-border pt-3 space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Enviar teste pra um número (opcional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="h-9"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTest}
                      disabled={testing}
                      className="whitespace-nowrap"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar teste'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cloudMode
                      ? 'Manda o template só pra esse número, sem tocar nos leads.'
                      : 'Manda a sequência inteira só pra esse número, sem tocar nos leads.'}
                  </p>
                </div>
              </div>
            )}

            {/* STEP creating / done */}
            {step === 'creating' && (
              <div className="space-y-3 py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div className="text-sm">Criando o disparo...</div>
              </div>
            )}
            {step === 'done' && (
              <div className="space-y-3 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                <div className="text-lg font-semibold">Disparo no ar</div>
                <div className="text-sm text-muted-foreground">
                  As mensagens saem em lotes respeitando o ritmo escolhido. Acompanhe na aba "Disparos".
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {view === 'list' && <Button onClick={() => handleClose(false)}>Fechar</Button>}

          {view === 'new' && step === 'audience' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep('messages')} disabled={!step1Ok}>
                Próximo
              </Button>
            </>
          )}
          {view === 'new' && step === 'messages' && (
            <>
              <Button variant="outline" onClick={() => setStep('audience')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep('cadence')} disabled={!step2Ok}>
                Próximo
              </Button>
            </>
          )}
          {view === 'new' && step === 'cadence' && (
            <>
              <Button variant="outline" onClick={() => setStep('messages')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep('review')} disabled={!step3Ok}>
                Próximo
              </Button>
            </>
          )}
          {view === 'new' && step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('cadence')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleCreate} disabled={creating || !step1Ok || !step2Ok}>
                <Megaphone className="w-4 h-4 mr-1" /> Disparar pra {recipientCount}
              </Button>
            </>
          )}
          {view === 'new' && step === 'done' && (
            <Button onClick={() => setView('list')}>Ver disparos</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
