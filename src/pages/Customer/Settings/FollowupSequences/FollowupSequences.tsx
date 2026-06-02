import { useState, useEffect, useCallback } from 'react';
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
} from '@evoapi/design-system';
import { Clock, Edit, Send, ToggleLeft, ToggleRight, Trash2, Plus, GripVertical } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  followupSequencesService,
  FollowupSequence,
  FollowupStep,
  MESSAGE_TYPE_LABELS,
  formatDelay,
} from '@/services/followupSequences/followupSequencesService';

const EMPTY_STEP = (position: number): FollowupStep => ({
  position,
  delay_minutes: position * 60,
  message_type: 'text',
  content: '',
  media_url: '',
  media_caption: '',
  tag_on_send: `follow-up${position}`,
  move_to_stage_slug: position <= 2 ? 'follow-up-curto' : 'follow-up-longo',
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

  const openEdit = (seq: FollowupSequence) => {
    setEditing(seq);
    setSteps(seq.steps.length ? [...seq.steps] : Array.from({ length: 6 }, (_, i) => EMPTY_STEP(i + 1)));
    setEditorOpen(true);
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
    setSaving(true);
    try {
      await followupSequencesService.update(editing.id, {
        name: editing.name,
        description: editing.description ?? undefined,
        is_active: editing.is_active,
        stop_on_reply: editing.stop_on_reply,
        business_hours_only: editing.business_hours_only,
        followup_steps_attributes: steps.map((s, i) => ({ ...s, position: i + 1 })),
      });
      toast.success('Sequência salva.');
      closeEditor();
      load();
    } catch {
      toast.error('Falha ao salvar.');
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            Sequências de mensagens disparadas quando o lead não responde. Edite cada passo abaixo.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-12 w-12" />}
          title="Nenhuma sequência cadastrada"
          description="As sequências aparecem aqui após o primeiro deploy."
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
                    {seq.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
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
            <DialogTitle>Editar sequência: {editing?.name}</DialogTitle>
            <DialogDescription>
              Tempos são cumulativos desde o início. Use {`{{nome}}`} pra inserir o primeiro nome do lead.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <UILabel>Nome</UILabel>
                  <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <UILabel>Slug (não editar)</UILabel>
                  <Input value={editing.slug} disabled />
                </div>
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
                      <UILabel className="text-xs">Mensagem ({`{{nome}}`} é interpolado)</UILabel>
                      <Textarea
                        rows={2}
                        value={s.content ?? ''}
                        onChange={e => updateStep(idx, { content: e.target.value })}
                      />
                    </div>

                    {s.message_type !== 'text' && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <UILabel className="text-xs">URL da mídia</UILabel>
                          <Input value={s.media_url ?? ''} onChange={e => updateStep(idx, { media_url: e.target.value })} />
                        </div>
                        <div>
                          <UILabel className="text-xs">Legenda (opcional)</UILabel>
                          <Input value={s.media_caption ?? ''} onChange={e => updateStep(idx, { media_caption: e.target.value })} />
                        </div>
                      </div>
                    )}

                    <div className="mt-2">
                      <UILabel className="text-xs">Mover pra coluna (slug)</UILabel>
                      <Input value={s.move_to_stage_slug ?? ''} onChange={e => updateStep(idx, { move_to_stage_slug: e.target.value })}
                             placeholder="follow-up-curto" />
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
            <Button onClick={saveSequence} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
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
