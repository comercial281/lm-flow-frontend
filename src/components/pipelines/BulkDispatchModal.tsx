import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from '@evoapi/design-system';
import {
  Megaphone,
  Users,
  MessageSquareText,
  Clock,
  ListChecks,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Pause,
  Play,
  Ban,
  ChevronLeft,
  Image as ImageIcon,
  Mic,
  Video,
  Upload,
  Send,
  Paperclip,
  Save,
  Bookmark,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PipelineStage } from '@/types/analytics';
import {
  broadcastsService,
  BroadcastCampaign,
  BroadcastVariation,
  AudienceMode,
} from '@/services/broadcasts/broadcastsService';
import { labelsService } from '@/services/contacts/labelsService';
import type { Label as LabelType } from '@/types/settings';

interface BulkDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  pipelineName?: string;
  stages: PipelineStage[];
}

type Step = 'audience' | 'messages' | 'cadence' | 'review' | 'creating' | 'done';
type View = 'new' | 'list';

const textareaCls =
  'w-full min-h-[90px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y';

const STATUS_META: Record<BroadcastCampaign['status'], { label: string; cls: string }> = {
  running: { label: 'Enviando', cls: 'bg-primary/15 text-primary border-primary/40' },
  paused: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function preview(text: string, name = 'Giovani') {
  return text.replace(/\{\{?\s*nome\s*\}?\}/gi, name);
}

const KINDS: { kind: BroadcastVariation['kind']; label: string; icon: typeof Mic }[] = [
  { kind: 'text', label: 'Texto', icon: MessageSquareText },
  { kind: 'image', label: 'Imagem', icon: ImageIcon },
  { kind: 'audio', label: 'Áudio', icon: Mic },
  { kind: 'video', label: 'Vídeo', icon: Video },
];

const KIND_LABEL: Record<BroadcastVariation['kind'], string> = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
};

function acceptFor(kind: BroadcastVariation['kind']) {
  if (kind === 'image') return 'image/*';
  if (kind === 'audio') return 'audio/*';
  if (kind === 'video') return 'video/*';
  return '*/*';
}

function isVariationValid(v: BroadcastVariation) {
  if (v.kind === 'text') return v.text.trim() !== '';
  return (v.media_url || '').trim() !== ''; // imagem/áudio/vídeo precisam de arquivo
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

  // Mensagens
  const [variations, setVariations] = useState<BroadcastVariation[]>([{ kind: 'text', text: '' }]);

  // Modelos de envio salvos (reutilizáveis). Guardados no navegador — por enquanto
  // por dispositivo; dá pra promover a compartilhado no backend depois.
  const TPL_KEY = 'lmflow:broadcast-msg-templates';
  const [msgTemplates, setMsgTemplates] = useState<{ name: string; variations: BroadcastVariation[] }[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TPL_KEY);
      if (raw) setMsgTemplates(JSON.parse(raw));
    } catch {
      /* localStorage indisponível */
    }
  }, []);
  const persistTemplates = (list: { name: string; variations: BroadcastVariation[] }[]) => {
    setMsgTemplates(list);
    try {
      localStorage.setItem(TPL_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };
  const saveCurrentAsTemplate = () => {
    if (!variations.some(v => v.text?.trim() || v.media_url)) {
      toast.error('Escreva a mensagem antes de salvar o modelo.');
      return;
    }
    const name = window.prompt('Nome do modelo:')?.trim();
    if (!name) return;
    const next = [
      ...msgTemplates.filter(t => t.name !== name),
      { name, variations: JSON.parse(JSON.stringify(variations)) },
    ];
    persistTemplates(next);
    toast.success('Modelo salvo');
  };
  const applyTemplate = (tpl: { name: string; variations: BroadcastVariation[] }) => {
    setVariations(
      tpl.variations?.length ? JSON.parse(JSON.stringify(tpl.variations)) : [{ kind: 'text', text: '' }],
    );
    toast.success(`Modelo "${tpl.name}" aplicado`);
  };
  const deleteTemplate = (name: string) => persistTemplates(msgTemplates.filter(t => t.name !== name));

  // Cadência
  const [minS, setMinS] = useState(4);
  const [maxS, setMaxS] = useState(8);
  const [batchSize, setBatchSize] = useState(10);
  const [pauseS, setPauseS] = useState(60);
  const [businessHours, setBusinessHours] = useState(true);

  // Mídia + teste
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const textRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
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
    setVariations([{ kind: 'text', text: '' }]);
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

  // Ao abrir: carrega campanhas e decide a view inicial.
  useEffect(() => {
    if (!open) return;
    resetWizard();
    refreshList().then(list => {
      const hasActive = list.some(c => c.status === 'running' || c.status === 'paused');
      setView(hasActive ? 'list' : 'new');
    });
    // Etiquetas disponíveis pra segmentar por tag.
    labelsService
      .getLabels()
      .then(res => setAvailableLabels(Array.isArray(res.data) ? (res.data as LabelType[]) : []))
      .catch(() => setAvailableLabels([]));
  }, [open, refreshList, resetWizard]);

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

  const validVariations = useMemo(() => variations.filter(isVariationValid), [variations]);

  const step1Ok = (recipientCount ?? 0) > 0;
  const step2Ok = validVariations.length > 0 && validVariations.length === variations.length;
  const step3Ok = minS >= 2 && maxS >= minS && batchSize >= 1 && batchSize <= 50 && pauseS >= 10;

  const estDurationMin = useMemo(() => {
    const n = recipientCount ?? 0;
    if (!n) return 0;
    const avg = (minS + maxS) / 2;
    const pauses = Math.max(0, Math.ceil(n / batchSize) - 1);
    return Math.round((n * avg + pauses * pauseS) / 60);
  }, [recipientCount, minS, maxS, batchSize, pauseS]);

  const updateVariation = (i: number, patch: Partial<BroadcastVariation>) =>
    setVariations(vs => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVariation = () =>
    setVariations(vs => (vs.length >= 4 ? vs : [...vs, { kind: 'text', text: '' }]));
  const removeVariation = (i: number) =>
    setVariations(vs => (vs.length <= 1 ? vs : vs.filter((_, idx) => idx !== i)));

  // Insere a variável (ex: {{nome}}) na posição do cursor do textarea da versão i.
  const insertVariable = (i: number, token: string) => {
    const el = textRefs.current[i];
    const cur = variations[i]?.text || '';
    if (!el) {
      updateVariation(i, { text: cur + token });
      return;
    }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    updateVariation(i, { text: cur.slice(0, start) + token + cur.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleUpload = async (i: number, file?: File) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 16MB).');
      return;
    }
    setUploadingIdx(i);
    try {
      const { url } = await broadcastsService.uploadMedia(file);
      updateVariation(i, { media_url: url });
      toast.success('Arquivo anexado.');
    } catch {
      toast.error('Não consegui enviar o arquivo.');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleTest = async () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Número inválido (use DDD + número, ex: 5511999999999).');
      return;
    }
    const v = validVariations[0];
    if (!v) {
      toast.error('Escreva a mensagem antes de testar.');
      return;
    }
    setTesting(true);
    try {
      await broadcastsService.testSend(phone, v);
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
        name: undefined,
        pipeline_id: pipelineId,
        audience: {
          mode: audienceMode,
          stage_id: audienceMode === 'stage' ? stageId : undefined,
          labels: audienceMode === 'tag' ? selectedLabels : undefined,
        },
        variations: validVariations.map(v => ({ kind: v.kind, text: v.text, media_url: v.media_url })),
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
              ? 'Escolha quem recebe, escreva a mensagem (pode variar até 4 versões), ajuste o ritmo e dispare.'
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

            {/* STEP 2 — Mensagens */}
            {step === 'messages' && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <MessageSquareText className="w-4 h-4" /> Mensagem(ns)
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Use <code className="text-primary">{'{{nome}}'}</code> pro primeiro nome do lead
                  </span>
                </div>

                {/* Modelos de envio: salvar o que está escrito e reaproveitar depois */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Bookmark className="w-3.5 h-3.5" /> Modelos
                  </span>
                  {msgTemplates.length === 0 && (
                    <span className="text-xs text-muted-foreground">nenhum salvo ainda</span>
                  )}
                  {msgTemplates.map(tpl => (
                    <span
                      key={tpl.name}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="hover:text-primary"
                        title="Aplicar este modelo"
                      >
                        {tpl.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.name)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir modelo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveCurrentAsTemplate}
                    className="ml-auto h-7"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar modelo
                  </Button>
                </div>
                {variations.map((v, i) => (
                  <div key={i} className="space-y-2 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Versão {i + 1}
                        {variations.length > 1 && ' (alternadas entre os contatos)'}
                      </span>
                      {variations.length > 1 && (
                        <button
                          onClick={() => removeVariation(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* tipo de mensagem */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {KINDS.map(k => {
                        const Icon = k.icon;
                        const active = v.kind === k.kind;
                        return (
                          <button
                            key={k.kind}
                            onClick={() => updateVariation(i, { kind: k.kind })}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {k.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* texto (ou legenda da mídia); áudio não tem texto */}
                    {v.kind !== 'audio' && (
                      <>
                        <textarea
                          ref={el => {
                            textRefs.current[i] = el;
                          }}
                          value={v.text}
                          onChange={e => updateVariation(i, { text: e.target.value })}
                          placeholder={
                            v.kind === 'text' ? 'Oi {{nome}}, tudo bem? ...' : 'Legenda (opcional)'
                          }
                          className={textareaCls}
                        />
                        {/* Inserir variável clicando (vai pro cursor) */}
                        <button
                          type="button"
                          onClick={() => insertVariable(i, '{{nome}}')}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Plus className="w-3 h-3" /> {'{{nome}}'}
                        </button>
                      </>
                    )}

                    {/* upload de mídia (imagem/áudio/vídeo) */}
                    {v.kind !== 'text' && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={el => {
                            fileRefs.current[i] = el;
                          }}
                          type="file"
                          accept={acceptFor(v.kind)}
                          className="hidden"
                          onChange={e => handleUpload(i, e.target.files?.[0])}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileRefs.current[i]?.click()}
                          disabled={uploadingIdx === i}
                        >
                          {uploadingIdx === i ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          {v.media_url ? 'Trocar arquivo' : 'Enviar arquivo'}
                        </Button>
                        {v.media_url && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> anexado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {variations.length < 4 && (
                  <Button variant="outline" size="sm" onClick={addVariation}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar variação
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Variar a mensagem reduz a chance de o WhatsApp marcar como spam.
                </p>
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
                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Destinatários</span>
                    <strong>{recipientCount}</strong>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">Versões de mensagem</span>
                    <strong>{validVariations.length}</strong>
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
                <div className="space-y-2">
                  {validVariations.map((v, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                      <span className="text-xs text-muted-foreground block mb-1">
                        Versão {i + 1} · {KIND_LABEL[v.kind]}
                      </span>
                      {v.kind !== 'text' && (
                        <span className="text-xs text-primary flex items-center gap-1 mb-1">
                          <Paperclip className="w-3 h-3" /> mídia anexada
                        </span>
                      )}
                      {v.text ? (
                        preview(v.text)
                      ) : (
                        <span className="text-muted-foreground italic">(sem legenda)</span>
                      )}
                    </div>
                  ))}
                </div>

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
                    Manda a Versão 1 só pra esse número, sem tocar nos leads.
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
