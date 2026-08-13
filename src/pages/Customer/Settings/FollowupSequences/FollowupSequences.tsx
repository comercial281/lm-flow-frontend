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
import { Clock, Edit, Send, ToggleLeft, ToggleRight, Trash2, Plus, GripVertical, Upload, Loader2, Mic, Square, Sparkles, History, LayoutGrid, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  followupSequencesService,
  followupAdminService,
  FollowupSequence,
  FollowupStep,
  FollowupTemplate,
  FollowupHistory,
  MESSAGE_TYPE_LABELS,
  formatDelay,
} from '@/services/followupSequences/followupSequencesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline, PipelineStage } from '@/types/analytics';
import { SequenceEntries } from './SequenceEntries';
import {
  UNITS,
  unitFactor,
  pickUnit,
  toRelativeSteps,
  toCumulativeSteps,
  cumulativeUpTo,
  type DelayUnit,
} from './delayConversion';
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

// Passo novo nasce SEM etiqueta e SEM mover o card.
//
// Antes vinha com `follow-up<N>` e com a coluna preenchidas. As duas eram armadilha:
//
// - a etiqueta por passo ACUMULA (uma por mensagem enviada, nunca removida) e é
//   exatamente o que o marcador de progresso do funil veio substituir. Com as duas
//   ligadas o card recebia as duas marcações, e a promessa de "uma etiqueta só"
//   virava mentira já no funil recém-criado.
// - a coluna vinha apontando pra "follow-up-longo" a partir do passo 3, então o
//   card SAÍA da coluna do funil no meio do fluxo sem ninguém ter pedido.
//
// Quem quiser qualquer uma das duas escolhe no passo — a diferença é que agora é
// escolha, não default silencioso.
const EMPTY_STEP = (position: number): FollowupStep => ({
  position,
  // Relativo: a primeira sai assim que o lead entra, as seguintes um dia depois da
  // anterior — cadência de follow-up de imóvel, não de minutos.
  delay_minutes: position === 1 ? 0 : 1440,
  message_type: 'text',
  content: '',
  media_url: '',
  media_caption: '',
  tag_on_send: '',
  move_to_stage_slug: '',
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
  progress_tagging: true,
  steps_count: 0,
  // Funil que ainda não existe não tem entrada: elas só podem ser criadas depois
  // de salvar, porque cada uma é uma regra apontando pro funil.
  entries_count: 0,
  steps: [],
  created_at: '',
  updated_at: '',
});

const formatMoment = (epochSeconds: number | null): string => {
  if (!epochSeconds) return '—';
  return new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

// Um cancelamento por resposta do lead é SUCESSO — a sequência parou porque
// funcionou. Os outros cancelamentos (funil desligado, lead sem telefone, fila
// substituída) são outra história, e misturar os dois numa etiqueta só faria o
// histórico parecer cheio de erro. O backend grava a mesma frase nos dois
// caminhos que cancelam por resposta.
const repliedStop = (lastError: string | null): boolean =>
  (lastError ?? '').includes('lead replied');

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  sent:      { label: 'Enviada',   className: 'border-green-500/40 text-green-600 dark:text-green-400' },
  pending:   { label: 'Agendada',  className: 'border-border text-muted-foreground' },
  failed:    { label: 'Falhou',    className: 'border-red-500/40 text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelada', className: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
};

export default function FollowupSequences() {
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FollowupSequence | null>(null);
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  // Quais passos estão com "Mais opções" aberto. Abre sozinho no passo que JÁ tem
  // coluna ou etiqueta configurada — esconder o que o cliente configurou seria pior
  // que o excesso de campos que a gaveta veio resolver.
  const [openAdvanced, setOpenAdvanced] = useState<Record<number, boolean>>({});
  // Unidade escolhida por passo. Fica em estado próprio (e não derivada do número)
  // porque derivar faria a unidade pular sozinha enquanto a pessoa digita: 120
  // viraria "2 horas" no meio da digitação de 1200.
  const [stepUnits, setStepUnits] = useState<Record<number, DelayUnit>>({});
  const [editorOpen, setEditorOpen] = useState(false);

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSeqId, setTestSeqId] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({});
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Escolher modelo. Antes o botão aplicava o pacote de marketing direto, sem
  // mostrar o que ia acontecer — e quando falhava não dava pra saber o que teria
  // sido criado. Agora a escolha é explícita e a prévia vem junto.
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<FollowupTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // Histórico do funil.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<FollowupHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    setStepUnits({});
    setEditorOpen(true);
    pipelines.forEach(p => {
      if (!stagesByPipeline[p.id]) loadStages(p.id);
    });
  };

  const openTemplates = async () => {
    setTemplateDialogOpen(true);
    setPreviewKey(null);
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    try {
      setTemplates(await followupSequencesService.getTemplates());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Falha ao carregar os modelos.'));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const createFromTemplate = async (tpl: FollowupTemplate) => {
    setCreatingTemplate(tpl.key);
    try {
      const seq = await followupSequencesService.createFromTemplate(tpl.key);
      toast.success(`Funil "${seq.name}" criado com ${seq.steps_count} mensagens. Revise os textos e os tempos.`);
      setTemplateDialogOpen(false);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Falha ao criar o funil a partir do modelo.'));
    } finally {
      setCreatingTemplate(null);
    }
  };

  // O pacote de marketing continua disponível, mas agora como escolha declarada:
  // ele cria pipeline, colunas, etiquetas e regras além dos funis, e é a única
  // opção daqui que pode esbarrar em permissão.
  const applyTemplate = async () => {
    setApplyingTemplate(true);
    try {
      const out = await followupAdminService.reseedTemplate();
      toast.success(`Pacote aplicado: ${out.sequences.length} funis, ${out.stages_count} colunas.`);
      setTemplateDialogOpen(false);
      load();
    } catch (e) {
      // Mensagem REAL do servidor: a recusa mais comum é de cargo, e a frase fixa
      // que existia antes ("verifique se o tenant tem usuário admin") mandava
      // procurar no lugar errado.
      toast.error(apiErrorMessage(e, 'Falha ao aplicar o pacote.'));
    } finally {
      setApplyingTemplate(false);
    }
  };

  const openHistory = async (seq: FollowupSequence) => {
    setHistoryOpen(true);
    setHistory(null);
    setHistoryLoading(true);
    try {
      setHistory(await followupSequencesService.getHistory(seq.id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Falha ao carregar o histórico.'));
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openEdit = (seq: FollowupSequence) => {
    setEditing(seq);
    setSteps(seq.steps.length ? toRelativeSteps(seq.steps) : Array.from({ length: 6 }, (_, i) => EMPTY_STEP(i + 1)));
    setStepUnits({});
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
    setStepUnits({});
  };

  const updateStep = (idx: number, patch: Partial<FollowupStep>) => {
    setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const unitOf = (idx: number): DelayUnit =>
    stepUnits[idx] ?? pickUnit(Number(steps[idx]?.delay_minutes) || 0);

  // Trocar a unidade não muda o tempo "de mentira": o número exibido é arredondado
  // pra nova unidade e o valor guardado passa a ser exatamente esse. Sem isto, 90
  // minutos vistos em "horas" apareceriam como 2 e continuariam valendo 90.
  const changeUnit = (idx: number, unit: DelayUnit) => {
    const factor = unitFactor(unit);
    const rounded = Math.max(0, Math.round((Number(steps[idx]?.delay_minutes) || 0) / factor));
    setStepUnits(prev => ({ ...prev, [idx]: unit }));
    updateStep(idx, { delay_minutes: rounded * factor });
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
      progress_tagging: editing.progress_tagging,
      // A tela edita relativo; a API recebe cumulativo. Converter aqui é o que
      // permite guardar do jeito que a retomada e o horário comercial precisam.
      followup_steps_attributes: toCumulativeSteps(steps).map((s, i) => ({ ...s, position: i + 1 })),
    };

    setSaving(true);
    try {
      if (isNew) {
        // NÃO fechar o editor aqui. As entradas ("Quando este funil começa") só
        // existem depois que o funil tem identidade, então fechar deixava a pessoa
        // num beco: a seção pedia pra salvar, e salvar tirava a seção da frente.
        // Religar o editor ao funil recém-criado deixa escolher a entrada na hora.
        const created = await followupSequencesService.create(payload);
        setEditing(created);
        setSteps(created.steps?.length ? toRelativeSteps(created.steps) : []);
        setStepUnits({});
        toast.success('Funil criado. Agora escolha, logo abaixo, o que faz ele começar.');
      } else {
        await followupSequencesService.update(editing.id, payload);
        toast.success('Sequência salva.');
        closeEditor();
      }
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
          <Button variant="outline" onClick={openTemplates}>
            <Sparkles className="mr-1 h-4 w-4" />
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
        <h2 className="mb-1 text-lg font-medium">Follow-up iniciado à mão</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          O disparo automático de cada funil mora dentro do próprio funil, em{' '}
          <strong>Quando este funil começa</strong>. Aqui fica só o que não é de um funil
          específico: quando o corretor põe o lead no follow-up pelo botão do card, a
          origem do lead decide qual funil ele recebe.
        </p>
        {/* A `key` remonta esta seção quando o CONJUNTO de funis muda (criou, apagou,
            ligou/desligou). Sem isso, quem acabava de criar o primeiro funil continuava
            lendo "Nenhum funil de follow-up ativo" aqui em cima até dar F5 — e a tela
            recém-desbloqueada parecia quebrada de novo. */}
        <FollowupEnrollment embedded key={sequences.map(s => `${s.id}:${s.is_active}`).join(',')} />

        {/* A seção "Quem não respondeu" (o antigo Robô Sem Resposta) saiu daqui em
            2026-08-13, por decisão do dono do produto: enquanto o fluxo por coluna —
            arrastar o card — não estiver validado, follow-up não deve ser disparado
            por silêncio. A varredura é desligada pelo backend na mesma entrega, pra
            não sobrar rodando sem lugar nenhum de desligar. */}
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nenhum funil de follow-up ainda"
          description="Crie o seu do zero, escrevendo as mensagens e os tempos. Ou escolha um modelo pronto ali em cima: são funis já escritos, e você ajusta o texto depois."
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
                    {/* Funil ativo e sem porta de entrada não dispara nada sozinho.
                        Sem este aviso, quem monta as mensagens e sai da tela acha que
                        ligou o follow-up — e fica esperando uma mensagem que nunca sai. */}
                    {seq.is_active && seq.entries_count === 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-xs text-amber-600"
                        title="Abra o funil e configure em 'Quando este funil começa'."
                      >
                        sem entrada
                      </Badge>
                    )}
                    {seq.entries_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {seq.entries_count === 1 ? '1 entrada' : `${seq.entries_count} entradas`}
                      </Badge>
                    )}
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
                  <Button variant="outline" size="sm" onClick={() => openHistory(seq)}>
                    <History className="mr-1 h-3 w-3" /> Histórico
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

              {/* O marcador é o que faz o funil RETOMAR. Sem ele o lead que volta
                  pra coluna recebe a mensagem 1 de novo — foi a queixa do dono do
                  produto. Fica em bloco próprio (e não junto dos dois acima) porque
                  precisa da explicação: a chave sozinha não diz o que ela faz. */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={editing.progress_tagging}
                    onChange={e => setEditing({ ...editing, progress_tagging: e.target.checked })}
                  />
                  <span>
                    Marcar no card em que mensagem o lead parou
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      O card fica com uma etiqueta só, trocada a cada envio
                      {editing.progress_tag_sample ? ` (ex.: ${editing.progress_tag_sample})` : ''}.
                      Se o lead responder e depois voltar para o funil, ele continua da
                      mensagem seguinte em vez de receber tudo de novo.
                    </span>
                  </span>
                </label>
              </div>

              {/* "Quando este funil começa" vem ANTES das mensagens de propósito:
                  a primeira pergunta de quem monta um funil é o que o dispara, e
                  era exatamente isso que a tela não respondia — a escolha morava
                  num painel global, longe daqui, valendo pra um funil só. */}
              <SequenceEntries
                sequenceId={editing.id || null}
                sequenceName={editing.name}
                onChanged={load}
              />

              <div className="space-y-3">
                {steps.map((s, idx) => {
                  // "Mais opções" guarda o que é exceção: mover o card e a etiqueta fixa.
                  // Antes os dois ficavam abertos em TODO passo, então um funil de 10
                  // mensagens pedia 10 vezes um pipeline e uma coluna — configuração por
                  // mensagem, quando a decisão do funil é por FLUXO. Abre sozinho onde já
                  // houver algo configurado, pra não esconder escolha de ninguém.
                  const hasAdvanced =
                    Boolean(s.move_to_stage_slug) ||
                    (!editing.progress_tagging && Boolean(s.tag_on_send));
                  const advancedOpen = openAdvanced[idx] ?? hasAdvanced;

                  return (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">Passo #{idx + 1}</span>
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeStep(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <UILabel className="text-xs">Esperar</UILabel>
                        <div className="flex gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            className="flex-1"
                            value={Math.round(s.delay_minutes / unitFactor(unitOf(idx)))}
                            onChange={e => updateStep(idx, {
                              delay_minutes: Math.max(0, Number(e.target.value) || 0) * unitFactor(unitOf(idx)),
                            })}
                          />
                          <select
                            aria-label={`Unidade do passo ${idx + 1}`}
                            value={unitOf(idx)}
                            onChange={e => changeUnit(idx, e.target.value as DelayUnit)}
                            className="rounded-md border border-border bg-background px-2 text-sm"
                          >
                            {UNITS.map(u => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {idx === 0 ? 'depois de o lead entrar no funil' : 'depois da mensagem anterior'}
                          {s.delay_minutes === 0 && idx === 0 ? ' — sai na hora' : ''}
                          {idx > 0 && ` — ≈ ${formatDelay(cumulativeUpTo(steps, idx))} desde o início`}
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
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setOpenAdvanced(prev => ({ ...prev, [idx]: !advancedOpen }))}
                      >
                        {advancedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Mais opções
                      </button>

                      {advancedOpen && (
                        <div className="mt-2 space-y-3 rounded-md border bg-muted/20 p-3">
                          {!editing.progress_tagging && (
                            <div>
                              <UILabel className="text-xs">Tag ao enviar</UILabel>
                              <Input value={s.tag_on_send ?? ''} onChange={e => updateStep(idx, { tag_on_send: e.target.value })} />
                            </div>
                          )}
                          <div>
                            <UILabel className="text-xs">Mover o card de coluna nesta mensagem</UILabel>
                            <p className="mb-1 text-xs text-muted-foreground">
                              Deixe em branco para o lead continuar na coluna em que já está.
                            </p>
                            <StageSelector
                              currentSlug={s.move_to_stage_slug ?? ''}
                              pipelines={pipelines}
                              stagesByPipeline={stagesByPipeline}
                              loadStages={loadStages}
                              onChange={(slug) => updateStep(idx, { move_to_stage_slug: slug })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}

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
            {/* O texto antigo era pra programador: falava em "os 6 jobs" (são os
                passos que a pessoa escreveu) e mandava usar um endereço interno.
                Aqui o que importa é o efeito: sai mensagem de verdade, e o número
                vira contato no CRM. */}
            <DialogDescription>
              As mensagens deste funil são enviadas de verdade para esse número, respeitando
              os tempos que você configurou. O número vira um contato no CRM — vale apagar
              depois se for só teste. Testar duas vezes no mesmo número não recomeça do
              início: o funil continua da mensagem seguinte.
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

      {/* Escolher modelo pronto */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modelos prontos</DialogTitle>
            <DialogDescription>
              Cada modelo cria um funil já escrito, pra você editar. Ele não entra em ação sozinho:
              só manda mensagem depois que você apontar o disparo automático pra ele, ali em cima,
              ou usar o botão Testar.
            </DialogDescription>
          </DialogHeader>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(tpl => (
                <div key={tpl.key} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <h3 className="font-medium">{tpl.name}</h3>
                        <Badge variant="outline">{tpl.steps_count} mensagens</Badge>
                        {tpl.business_hours_only && (
                          <Badge variant="outline" className="text-xs">só em horário comercial</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{tpl.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => createFromTemplate(tpl)}
                        disabled={creatingTemplate !== null}
                      >
                        {creatingTemplate === tpl.key
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : <Plus className="mr-1 h-3 w-3" />}
                        Usar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewKey(previewKey === tpl.key ? null : tpl.key)}
                      >
                        {previewKey === tpl.key ? 'Ocultar' : 'Ver mensagens'}
                      </Button>
                    </div>
                  </div>

                  {previewKey === tpl.key && (
                    <div className="mt-3 grid gap-2 border-t pt-3">
                      {tpl.steps.map(s => (
                        <div key={s.position} className="flex items-start gap-3 rounded border bg-background p-2 text-sm">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono">#{s.position}</span>
                          <span className="shrink-0 text-muted-foreground">{formatDelay(s.delay_minutes)}</span>
                          <span className="flex-1">{s.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* O pacote de marketing é outra categoria de coisa: mexe no CRM inteiro.
                  Fica separado e avisado, pra ninguém aplicar achando que é só um funil. */}
              <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Pacote completo de marketing</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Além de dois funis, cria um pipeline novo com suas colunas, as etiquetas de
                      origem e as regras que ligam tudo. Use num CRM que está começando do zero —
                      num CRM já em uso, prefira um modelo de funil acima.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={applyTemplate}
                    disabled={applyingTemplate}
                  >
                    {applyingTemplate
                      ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      : <Sparkles className="mr-1 h-3 w-3" />}
                    Aplicar pacote
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Histórico do funil */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{history ? `Histórico: ${history.sequence.name}` : 'Histórico do funil'}</DialogTitle>
            <DialogDescription>
              O que este funil já fez. Para ver a linha do tempo de um lead específico, abra o card dele.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : history && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Leads no funil</p>
                  <p className="text-2xl font-semibold">{history.summary.leads}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Mensagens enviadas</p>
                  <p className="text-2xl font-semibold">{history.summary.sent}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Pararam porque responderam</p>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {history.summary.stopped_by_reply}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Ainda agendadas</p>
                  <p className="text-2xl font-semibold">{history.summary.pending}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Falharam</p>
                  <p className={`text-2xl font-semibold ${history.summary.failed > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {history.summary.failed}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Último envio</p>
                  <p className="text-sm font-medium pt-2">{formatMoment(history.summary.last_sent_at)}</p>
                </div>
              </div>

              {history.recent.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Este funil ainda não entrou em ação. Nenhum lead foi colocado nele até agora — nem
                  pelo disparo automático, nem pelo botão de teste.
                </div>
              ) : (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Últimos disparos</h3>
                  <div className="grid gap-2">
                    {history.recent.map(entry => {
                      const style = STATUS_STYLE[entry.status] ?? STATUS_STYLE.pending;
                      const byReply = entry.status === 'cancelled' && repliedStop(entry.last_error);
                      return (
                        <div
                          key={entry.id}
                          // O motivo cru do servidor ('lead replied', 'contact has no
                          // phone_number', o erro da Evolution) não cabe na linha e não
                          // é linguagem de usuário — mas é o que resolve o chamado.
                          title={entry.last_error ?? undefined}
                          className="flex items-start gap-3 rounded border bg-background p-2 text-sm"
                        >
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs ${byReply ? 'border-green-500/40 text-green-600 dark:text-green-400' : style.className}`}
                          >
                            {byReply ? 'Lead respondeu' : style.label}
                          </Badge>
                          <span className="shrink-0 font-medium">
                            {entry.contact.name || 'Sem nome'}
                          </span>
                          {entry.step && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono">
                              #{entry.step.position}
                            </span>
                          )}
                          <span className="flex-1 truncate text-muted-foreground">
                            {entry.step?.content || '—'}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatMoment(entry.executed_at ?? entry.run_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Falha some no meio da lista se não for dita em voz alta. */}
                  {history.summary.failed > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Passe o mouse sobre uma linha para ver o motivo registrado pelo servidor.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
