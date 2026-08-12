import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label as UILabel,
  Textarea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { Clock, Edit, Send, ToggleLeft, ToggleRight, Trash2, Plus, GripVertical, Upload, Loader2, Mic, Square, Sparkles } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  followupSequencesService,
  followupAdminService,
  FollowupSequence,
  FollowupStep,
  MESSAGE_TYPE_LABELS,
  formatDelay,
} from '@/services/followupSequences/followupSequencesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline, PipelineStage } from '@/types/analytics';
import { FollowupEnrollment } from '@/pages/Customer/Automations/FollowupEnrollment/FollowupEnrollment';

// Backend (Followup::SendStep#move_stage_if_configured) deriva o slug a partir do
// nome do stage e NORMALIZA os dois lados: transliterate + downcase + strip + '-'.
// Espelhamos exatamente isso aqui — com acento, 'follow-up-automatico' nao casava
// com a coluna "Follow-up Automático" e o passo nao movia o card, em silencio.
const slugifyStageName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/ /g, '-');

// Variáveis interpoladas pelo backend (Followup::SendStep#interpolate) — mesmos
// tokens da automação de lead.
const MESSAGE_VARS: { label: string; token: string }[] = [
  { label: 'Nome',          token: '{{nome}}' },
  { label: 'Nome completo', token: '{{nome_completo}}' },
  { label: 'Telefone',      token: '{{telefone}}' },
  { label: 'E-mail',        token: '{{email}}' },
  { label: 'Data',          token: '{{data}}' },
  { label: 'Hora',          token: '{{hora}}' },
  { label: 'Link do card',  token: '{{link_do_card}}' },
];

function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span className="text-xs text-muted-foreground mr-1">Inserir variável:</span>
      {MESSAGE_VARS.map(v => (
        <button
          key={v.token}
          type="button"
          onClick={() => onInsert(v.token)}
          className="text-xs px-2 py-0.5 rounded-full border border-input bg-muted/40 hover:bg-muted transition-colors"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function StageSelector({
  currentSlug,
  pipelines,
  stagesByPipeline,
  loadStages,
  onChange,
}: {
  currentSlug: string;
  pipelines: Pipeline[];
  stagesByPipeline: Record<string, PipelineStage[]>;
  loadStages: (pipelineId: string) => void;
  onChange: (slug: string) => void;
}) {
  // Pipeline inferido a partir do slug salvo: varre os caches ja carregados
  // e pega o primeiro pipeline cujo stage matche o slug. Best-effort: se o
  // stages ainda nao tiver carregado, fica vazio ate o useEffect popular.
  const inferredPipelineId = useMemo(() => {
    if (!currentSlug) return '';
    for (const p of pipelines) {
      const stages = stagesByPipeline[p.id];
      if (!stages) continue;
      if (stages.some(s => slugifyStageName(s.name) === currentSlug)) {
        return p.id;
      }
    }
    return '';
  }, [currentSlug, pipelines, stagesByPipeline]);

  const [pipelineId, setPipelineId] = useState<string>(inferredPipelineId);

  // Quando o cache carrega depois do mount, sincroniza a selecao.
  useEffect(() => {
    if (!pipelineId && inferredPipelineId) setPipelineId(inferredPipelineId);
  }, [inferredPipelineId, pipelineId]);

  const stages = pipelineId ? (stagesByPipeline[pipelineId] ?? []) : [];
  const matchedStage = stages.find(s => slugifyStageName(s.name) === currentSlug);
  const slugVisivelMasSemMatch = currentSlug && pipelineId && !matchedStage;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <UILabel className="text-xs">Pipeline</UILabel>
        <Select
          value={pipelineId}
          onValueChange={(v) => {
            setPipelineId(v);
            if (!stagesByPipeline[v]) loadStages(v);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha o pipe" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <UILabel className="text-xs">Mover pra coluna</UILabel>
        <Select
          value={matchedStage?.id ?? ''}
          onValueChange={(stageId) => {
            const st = stages.find(s => s.id === stageId);
            if (st) onChange(slugifyStageName(st.name));
          }}
          disabled={!pipelineId || stages.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={pipelineId ? 'Escolha a coluna' : 'Escolha o pipeline primeiro'}
            />
          </SelectTrigger>
          <SelectContent>
            {stages.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {slugVisivelMasSemMatch && (
        <p className="col-span-2 text-xs text-muted-foreground">
          Slug atual <code className="rounded bg-muted px-1">{currentSlug}</code> nao bate com
          nenhuma coluna deste pipeline. Escolha uma coluna pra sobrescrever.
        </p>
      )}
      {currentSlug && !pipelineId && (
        <p className="col-span-2 text-xs text-muted-foreground">
          Slug atual <code className="rounded bg-muted px-1">{currentSlug}</code>. Escolha o
          pipeline pra mapear pra coluna correta.
        </p>
      )}
    </div>
  );
}

// Mesma capacidade do modal de funil (MessageSequenceEditor): áudio pode ser
// ANEXADO (upload) ou GRAVADO na hora (MediaRecorder). Os outros tipos só upload.
function MediaUploadButton({
  messageType,
  onUploaded,
}: {
  messageType: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker';
  onUploaded: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordDur, setRecordDur] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const accept =
    messageType === 'audio'
      ? 'audio/*'
      : messageType === 'image'
      ? 'image/*'
      : messageType === 'sticker'
      ? 'image/png,image/webp'
      : messageType === 'document'
      ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf'
      : 'video/*';

  const doUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 16MB).');
      return;
    }
    setUploading(true);
    try {
      const out = await followupSequencesService.uploadMedia(file);
      onUploaded(out.url);
      toast.success(`Upload OK (${(out.byte_size / 1024).toFixed(0)} KB)`);
    } catch {
      toast.error('Falha no upload. Cheque tamanho (máx 16MB) e tipo.');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await doUpload(file);
    if (ref.current) ref.current.value = '';
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        void doUpload(new File([blob], `audio-${Date.now()}.webm`, { type: mimeType }));
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      setRecordDur(0);
      timerRef.current = window.setInterval(() => setRecordDur(d => d + 1), 1000);
    } catch {
      toast.error('Sem acesso ao microfone.');
    }
  };

  const stopRec = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (recording) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-red-500">
          {String(Math.floor(recordDur / 60)).padStart(2, '0')}:{String(recordDur % 60).padStart(2, '0')}
        </span>
        <Button type="button" variant="destructive" size="sm" onClick={stopRec} title="Parar gravação">
          <Square className="h-3 w-3" fill="currentColor" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      {messageType === 'audio' && (
        <Button type="button" variant="outline" size="sm" onClick={startRec} disabled={uploading} title="Gravar áudio">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading} title="Anexar arquivo">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
      </Button>
    </>
  );
}

const EMPTY_STEP = (position: number): FollowupStep => ({
  position,
  delay_minutes: position * 60,
  message_type: 'text',
  content: '',
  media_url: '',
  media_caption: '',
  tag_on_send: `follow-up${position}`,
  move_to_stage_slug: position <= 2 ? 'follow-up-automatico' : 'follow-up-longo',
});

// Funil em branco. `id` vazio é o que distingue "criando" de "editando" — o editor
// e o salvar decidem por ele. Nasce com 3 passos (e não 6, como o modelo pronto):
// tela de criação com 6 blocos vazios é um paredão pra quem só quer começar.
const NEW_SEQUENCE = (): FollowupSequence => ({
  id: '',
  name: '',
  slug: '',
  description: '',
  is_active: true,
  stop_on_reply: true,
  business_hours_only: false,
  steps_count: 0,
  steps: [],
  created_at: '',
  updated_at: '',
});

export default function FollowupSequences() {
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FollowupSequence | null>(null);
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSeqId, setTestSeqId] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({});
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSequences(await followupSequencesService.getAll());
    } catch {
      toast.error('Erro ao carregar sequências');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Carrega pipelines uma vez. Eles alimentam o Select de Pipeline em cada step.
  // Stages sao buscados sob demanda (loadStages) por pipeline pra nao explodir a UI.
  useEffect(() => {
    pipelinesService
      .getPipelines()
      .then(res => setPipelines(res.data ?? []))
      .catch(() => toast.error('Erro ao carregar pipelines'));
  }, []);

  const loadStages = useCallback((pipelineId: string) => {
    pipelinesService
      .getPipelineStages(pipelineId)
      .then(res => setStagesByPipeline(prev => ({ ...prev, [pipelineId]: res.data ?? [] })))
      .catch(() => toast.error('Erro ao carregar colunas do pipeline'));
  }, []);

  // Criar do zero. Até aqui a tela só sabia LISTAR e EDITAR: num CRM sem nenhum
  // funil não havia caminho nenhum pela interface, e o único jeito era o botão de
  // modelo pronto escondido na tela de Pipelines.
  const openCreate = () => {
    setEditing(NEW_SEQUENCE());
    setSteps(Array.from({ length: 3 }, (_, i) => EMPTY_STEP(i + 1)));
    setEditorOpen(true);
    pipelines.forEach(p => {
      if (!stagesByPipeline[p.id]) loadStages(p.id);
    });
  };

  const applyTemplate = async () => {
    setApplyingTemplate(true);
    try {
      const out = await followupAdminService.reseedTemplate();
      toast.success(`Modelo aplicado: ${out.sequences.length} funis criados.`);
      load();
    } catch (e) {
      // Mensagem REAL do servidor: a recusa mais comum é de cargo, e a frase fixa
      // que existia antes ("verifique se o tenant tem usuário admin") mandava
      // procurar no lugar errado.
      toast.error(apiErrorMessage(e, 'Falha ao aplicar o modelo.'));
    } finally {
      setApplyingTemplate(false);
    }
  };

  const openEdit = (seq: FollowupSequence) => {
    setEditing(seq);
    setSteps(seq.steps.length ? [...seq.steps] : Array.from({ length: 6 }, (_, i) => EMPTY_STEP(i + 1)));
    setEditorOpen(true);
    // Pre-popula stages de todos pipelines pra que o StageSelector consiga inferir
    // qual pipeline esta selecionado a partir do move_to_stage_slug ja salvo.
    pipelines.forEach(p => {
      if (!stagesByPipeline[p.id]) loadStages(p.id);
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setSteps([]);
  };

  const updateStep = (idx: number, patch: Partial<FollowupStep>) => {
    setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setSteps(prev => [...prev, EMPTY_STEP(prev.length + 1)]);
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i + 1 })));
  };

  const saveSequence = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Dê um nome ao funil.'); return; }

    // `id` vazio = funil novo. O slug NÃO vai no corpo: quem cria só dá o nome, e o
    // backend deriva e desempata o slug (é ele que as regras referenciam por dentro).
    const isNew = !editing.id;
    const payload = {
      name: editing.name.trim(),
      description: editing.description ?? undefined,
      is_active: editing.is_active,
      stop_on_reply: editing.stop_on_reply,
      business_hours_only: editing.business_hours_only,
      followup_steps_attributes: steps.map((s, i) => ({ ...s, position: i + 1 })),
    };

    setSaving(true);
    try {
      if (isNew) {
        await followupSequencesService.create(payload);
        toast.success('Funil criado.');
      } else {
        await followupSequencesService.update(editing.id, payload);
        toast.success('Sequência salva.');
      }
      closeEditor();
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, isNew ? 'Falha ao criar o funil.' : 'Falha ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (seq: FollowupSequence) => {
    try {
      await followupSequencesService.toggle(seq.id);
      load();
    } catch { toast.error('Falha ao alternar.'); }
  };

  const openTest = (seqId: string) => {
    setTestSeqId(seqId);
    setTestPhone('');
    setTestDialogOpen(true);
  };

  const fireTest = async () => {
    if (!testSeqId || !testPhone) return;
    try {
      const out = await followupSequencesService.testSend(testSeqId, testPhone);
      toast.success(`Disparado: ${out.pending_jobs} mensagens agendadas.`);
      setTestDialogOpen(false);
    } catch { toast.error('Falha ao disparar.'); }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Follow-up</h1>
          <p className="text-sm text-muted-foreground">
            Sequências de mensagens disparadas quando o lead não responde. Configure abaixo se o
            sistema coloca o lead no funil sozinho e edite cada passo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={applyTemplate} disabled={applyingTemplate}>
            {applyingTemplate ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Usar modelo pronto
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Novo funil
          </Button>
        </div>
      </header>

      {/* Config de enrolamento automático. Era uma aba separada ("Follow-up automático") e
          virou seção daqui: separar as duas escondia que a chave e o funil eram a mesma
          coisa — o usuário desligava numa aba achando que parava o que via na outra. */}
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Quando o funil dispara sozinho</h2>
        {/* A `key` remonta esta seção quando o CONJUNTO de funis muda (criou, apagou,
            ligou/desligou). Sem isso, quem acabava de criar o primeiro funil continuava
            lendo "Nenhum funil de follow-up ativo" aqui em cima até dar F5 — e a tela
            recém-desbloqueada parecia quebrada de novo. */}
        <FollowupEnrollment embedded key={sequences.map(s => `${s.id}:${s.is_active}`).join(',')} />
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nenhum funil de follow-up ainda"
          description="Crie o seu do zero, escrevendo as mensagens e os tempos. Ou use o modelo pronto ali em cima, que já vem com dois funis de seis mensagens pra você editar."
          action={{ label: 'Criar meu primeiro funil', onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4">
          {sequences.map(seq => (
            <div key={seq.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium">{seq.name}</h2>
                    <Badge variant={seq.is_active ? 'default' : 'outline'}>
                      {seq.is_active ? 'Ativa' : 'Desativada'}
                    </Badge>
                    <Badge variant="outline">{seq.steps_count} passos</Badge>
                  </div>
                  {seq.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{seq.description}</p>
                  )}
                  <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                    slug: {seq.slug}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggle(seq)}>
                    {seq.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openTest(seq.id)}>
                    <Send className="mr-1 h-3 w-3" /> Testar
                  </Button>
                  <Button variant="default" size="sm" onClick={() => openEdit(seq)}>
                    <Edit className="mr-1 h-3 w-3" /> Editar
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {seq.steps.map(s => (
                  <div key={s.id ?? s.position} className="flex items-center gap-3 rounded border bg-background p-2 text-sm">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono">#{s.position}</span>
                    <span className="text-muted-foreground">{formatDelay(s.delay_minutes)}</span>
                    <Badge variant="outline" className="text-xs">{MESSAGE_TYPE_LABELS[s.message_type]}</Badge>
                    <span className="flex-1 truncate">{s.content || <em className="text-muted-foreground">vazio</em>}</span>
                    {s.tag_on_send && <Badge variant="outline" className="text-xs">{s.tag_on_send}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing && !editing.id ? 'Novo funil de follow-up' : `Editar sequência: ${editing?.name}`}
            </DialogTitle>
            <DialogDescription>
              Tempos são cumulativos desde o início. Toque nas variáveis abaixo de cada mensagem pra inserir dados do lead.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <UILabel>Nome</UILabel>
                  <Input
                    value={editing.name}
                    autoFocus={!editing.id}
                    placeholder="Ex.: Follow-up de lead de anúncio"
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                {/* No funil novo o slug ainda não existe (o backend deriva do nome ao
                    salvar), então mostrar um campo vazio e travado só confundiria. */}
                {editing.id ? (
                  <div>
                    <UILabel>Slug (não editar)</UILabel>
                    <Input value={editing.slug} disabled />
                  </div>
                ) : (
                  <div>
                    <UILabel>Descrição</UILabel>
                    <Input
                      value={editing.description ?? ''}
                      placeholder="Pra que serve este funil"
                      onChange={e => setEditing({ ...editing, description: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Antes só dava pra mexer nisto pela API — e são as duas regras que
                  mais mudam o comportamento do funil na vida do lead. */}
              <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/20 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.stop_on_reply}
                    onChange={e => setEditing({ ...editing, stop_on_reply: e.target.checked })}
                  />
                  Parar quando o lead responder
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.business_hours_only}
                    onChange={e => setEditing({ ...editing, business_hours_only: e.target.checked })}
                  />
                  Só enviar em horário comercial
                </label>
              </div>

              <div className="space-y-3">
                {steps.map((s, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">Passo #{idx + 1}</span>
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeStep(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <UILabel className="text-xs">Delay (min, cumulativo)</UILabel>
                        <Input
                          type="number"
                          value={s.delay_minutes}
                          onChange={e => updateStep(idx, { delay_minutes: Number(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ≈ {formatDelay(s.delay_minutes)} após o início
                        </p>
                      </div>
                      <div>
                        <UILabel className="text-xs">Tipo</UILabel>
                        <Select value={s.message_type} onValueChange={(v) => updateStep(idx, { message_type: v as FollowupStep['message_type'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(MESSAGE_TYPE_LABELS).map(([v, lbl]) => (
                              <SelectItem key={v} value={v}>{lbl}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <UILabel className="text-xs">Tag ao enviar</UILabel>
                        <Input value={s.tag_on_send ?? ''} onChange={e => updateStep(idx, { tag_on_send: e.target.value })} />
                      </div>
                    </div>

                    <div className="mt-2">
                      <UILabel className="text-xs">Mensagem</UILabel>
                      <Textarea
                        rows={2}
                        value={s.content ?? ''}
                        onChange={e => updateStep(idx, { content: e.target.value })}
                        placeholder="Olá {{nome}}, tudo bem?"
                      />
                      <VariableChips onInsert={tok => updateStep(idx, { content: `${s.content ?? ''}${tok}` })} />
                    </div>

                    {s.message_type !== 'text' && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <UILabel className="text-xs">URL da mídia (ou clique upload)</UILabel>
                          <div className="flex gap-1">
                            <Input
                              className="flex-1"
                              value={s.media_url ?? ''}
                              onChange={e => updateStep(idx, { media_url: e.target.value })}
                              placeholder="https://... ou faça upload"
                            />
                            <MediaUploadButton
                              messageType={s.message_type}
                              onUploaded={url => updateStep(idx, { media_url: url })}
                            />
                          </div>
                        </div>
                        <div>
                          <UILabel className="text-xs">Legenda (opcional)</UILabel>
                          <Input value={s.media_caption ?? ''} onChange={e => updateStep(idx, { media_caption: e.target.value })} />
                          <VariableChips onInsert={tok => updateStep(idx, { media_caption: `${s.media_caption ?? ''}${tok}` })} />
                        </div>
                      </div>
                    )}

                    <div className="mt-2">
                      <StageSelector
                        currentSlug={s.move_to_stage_slug ?? ''}
                        pipelines={pipelines}
                        stagesByPipeline={stagesByPipeline}
                        loadStages={loadStages}
                        onChange={(slug) => updateStep(idx, { move_to_stage_slug: slug })}
                      />
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar passo
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
            <Button onClick={saveSequence} disabled={saving}>
              {saving ? 'Salvando...' : editing && !editing.id ? 'Criar funil' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test send Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testar sequência</DialogTitle>
            <DialogDescription>
              Cria um contato com esse telefone e enfileira os 6 jobs. Você pode disparar manualmente via /_admin/followup/process_now.
            </DialogDescription>
          </DialogHeader>
          <div>
            <UILabel>Telefone (com DDI, só números)</UILabel>
            <Input placeholder="5511949329570" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={fireTest} disabled={!testPhone}>Disparar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
