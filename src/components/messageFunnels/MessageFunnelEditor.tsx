import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label as UILabel,
  Textarea,
} from '@evoapi/design-system';
import {
  X, Trash2, Type, Mic, Image as ImageIcon, Video, FileText,
  RefreshCw, ChevronUp, ChevronDown, Square, Upload, Clock, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  MessageFunnel,
  MessageFunnelItem,
  FunnelItemKind,
  FunnelPayload,
  TemplateVariable,
} from '@/types/messageFunnels';
import { messageFunnelsService, tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';

// ── Constantes UI ────────────────────────────────────────────────────────────

const KIND_LABELS: Record<FunnelItemKind, string> = {
  text: 'Texto',
  audio: 'Áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
};
const KIND_ICONS: Record<FunnelItemKind, typeof Type> = {
  text: Type,
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
};
const KIND_COLORS: Record<FunnelItemKind, string> = {
  text: '#7c3aed',
  audio: '#00a884',
  image: '#3b82f6',
  video: '#f43f5e',
  document: '#f97316',
};

// ── Tipos internos ───────────────────────────────────────────────────────────

interface DraftItem {
  uiKey: string;
  position: number;
  kind: FunnelItemKind;
  text_content: string | null;
  media_url: string | null;
  media_filename: string | null;
  media_caption: string | null;
  delay_seconds: number;
  pendingFile: File | null;  // arquivo escolhido mas ainda não enviado
  serverItemId?: string;     // pra updates de item existente
}

function newDraftItem(kind: FunnelItemKind = 'text'): DraftItem {
  return {
    uiKey: crypto.randomUUID(),
    position: 0,
    kind,
    text_content: kind === 'text' ? '' : null,
    media_url: null,
    media_filename: null,
    media_caption: null,
    delay_seconds: 0,
    pendingFile: null,
  };
}

function draftFromServerItem(item: MessageFunnelItem): DraftItem {
  return {
    uiKey: item.id,
    serverItemId: item.id,
    position: item.position,
    kind: item.kind,
    text_content: item.text_content,
    media_url: item.media_url,
    media_filename: item.media_filename,
    media_caption: item.media_caption,
    delay_seconds: item.delay_seconds,
    pendingFile: null,
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  funnel?: MessageFunnel;            // undefined → criar; preenchido → editar
  onSaved?: (funnel: MessageFunnel) => void;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function MessageFunnelEditor({ open, onClose, funnel, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  // Carrega vars do tenant (built-in + custom) só uma vez ao abrir
  useEffect(() => {
    if (!open) return;
    tenantTemplateVariablesService
      .list()
      .then(res => {
        const all: TemplateVariable[] = [
          ...res.builtin,
          ...res.custom.map(v => ({
            token: v.token,
            placeholder: v.placeholder,
            label: v.label,
            description: v.description,
            builtin: false,
          })),
        ];
        setVariables(all);
      })
      .catch(() => {
        // fallback: só built-in hard-coded se o endpoint quebrar
        setVariables([
          { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
          { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
          { token: 'email', placeholder: '{{email}}', label: 'E-mail', builtin: true },
        ]);
      });
  }, [open]);

  // Reset form quando abre / troca de funnel editado
  useEffect(() => {
    if (!open) return;
    if (funnel) {
      setName(funnel.name);
      setDescription(funnel.description ?? '');
      setActive(funnel.active);
      setItems(
        funnel.items.length > 0
          ? funnel.items.map(draftFromServerItem)
          : [newDraftItem()],
      );
    } else {
      setName('');
      setDescription('');
      setActive(true);
      setItems([newDraftItem()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funnel?.id]);

  // ── Item ops ──────────────────────────────────────────────────────────────

  const updateItem = (uiKey: string, patch: Partial<DraftItem>) => {
    setItems(curr => curr.map(it => (it.uiKey === uiKey ? { ...it, ...patch } : it)));
  };

  const removeItem = (uiKey: string) => {
    setItems(curr => (curr.length > 1 ? curr.filter(it => it.uiKey !== uiKey) : curr));
  };

  const moveItem = (uiKey: string, direction: 'up' | 'down') => {
    setItems(curr => {
      const idx = curr.findIndex(it => it.uiKey === uiKey);
      if (idx < 0) return curr;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= curr.length) return curr;
      const next = [...curr];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const addItem = (kind: FunnelItemKind = 'text') => {
    setItems(curr => [...curr, newDraftItem(kind)]);
  };

  // ── Validate + Save ───────────────────────────────────────────────────────

  function validate(): string | null {
    if (!name.trim()) return 'Dê um nome ao funil.';
    if (items.length === 0) return 'Adicione pelo menos 1 item.';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'text' && !(it.text_content ?? '').trim()) {
        return `Item ${i + 1}: texto vazio.`;
      }
      if (it.kind !== 'text' && !it.media_url && !it.pendingFile) {
        return `Item ${i + 1}: mídia não anexada.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      const payload: FunnelPayload = {
        name: name.trim(),
        description: description.trim() || null,
        category: 'geral',
        active,
        shared: true,
        items: items.map((it, idx) => ({
          position: idx,
          kind: it.kind,
          text_content: it.text_content,
          media_caption: it.media_caption,
          media_filename: it.media_filename,
          delay_seconds: it.delay_seconds,
        })),
      };

      const saved = funnel
        ? await messageFunnelsService.update(funnel.id, payload)
        : await messageFunnelsService.create(payload);

      // Após salvar, sobe arquivos pendentes (cada um vincula ao item via id retornado)
      // O backend ordena items por position — alinhamos pela mesma ordem do array.
      const itemsPendentes = items
        .map((it, idx) => ({ draft: it, serverItem: saved.items[idx] }))
        .filter(p => p.draft.pendingFile && p.serverItem);

      for (const { draft, serverItem } of itemsPendentes) {
        await messageFunnelsService.uploadItemMedia(saved.id, serverItem.id, draft.pendingFile!);
      }

      // Re-fetch pra trazer media_url dos uploads
      const refreshed = itemsPendentes.length > 0
        ? await messageFunnelsService.get(saved.id)
        : saved;

      toast.success(funnel ? 'Funil atualizado' : 'Funil criado');
      onSaved?.(refreshed);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.message ?? 'Falha ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {funnel ? 'Editar funil' : 'Novo funil de mensagens'}
          </DialogTitle>
          <DialogDescription>
            Sequência multi-step que o atendente dispara com 1 clique no chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cabeçalho */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <UILabel htmlFor="funnel-name">Nome</UILabel>
              <Input
                id="funnel-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Saudação inicial"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <UILabel htmlFor="funnel-desc">Descrição (opcional)</UILabel>
              <Input
                id="funnel-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Quando usar este funil"
                maxLength={2000}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Funil ativo (aparece pro atendente no chat)</span>
            </label>
          </div>

          {/* Items */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Itens em sequência ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <ItemEditor
                  key={it.uiKey}
                  item={it}
                  index={idx}
                  totalCount={items.length}
                  variables={variables}
                  onUpdate={patch => updateItem(it.uiKey, patch)}
                  onRemove={() => removeItem(it.uiKey)}
                  onMoveUp={() => moveItem(it.uiKey, 'up')}
                  onMoveDown={() => moveItem(it.uiKey, 'down')}
                />
              ))}
            </div>
            <AddItemButtons onAdd={addItem} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <RefreshCw size={14} className="animate-spin mr-2" />}
            {funnel ? 'Salvar alterações' : 'Criar funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Item editor (per-step) ───────────────────────────────────────────────────

interface ItemEditorProps {
  item: DraftItem;
  index: number;
  totalCount: number;
  variables: TemplateVariable[];
  onUpdate: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ItemEditor({
  item, index, totalCount, variables, onUpdate, onRemove, onMoveUp, onMoveDown,
}: ItemEditorProps) {
  const Icon = KIND_ICONS[item.kind];
  const color = KIND_COLORS[item.kind];
  const [recording, setRecording] = useState(false);
  const [recordDur, setRecordDur] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  function selectFile(file: File) {
    onUpdate({
      pendingFile: file,
      media_filename: file.name,
      media_url: URL.createObjectURL(file),  // preview local
    });
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: mimeType });
        selectFile(file);
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      setRecordDur(0);
      timerRef.current = window.setInterval(() => setRecordDur(d => d + 1), 1000);
    } catch {
      toast.error('Sem acesso ao microfone');
    }
  }

  function stopRec() {
    mediaRecRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20">
      {/* Cabeçalho do item */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          style={{ background: color + '20', color }}
        >
          <Icon size={12} />
          <span className="text-xs font-semibold">{KIND_LABELS[item.kind]}</span>
        </div>
        {item.kind !== 'text' && (
          <select
            value={item.kind}
            onChange={e =>
              onUpdate({
                kind: e.target.value as FunnelItemKind,
                media_url: null,
                media_filename: null,
                pendingFile: null,
              })
            }
            className="text-xs bg-background border border-border rounded px-1.5 py-0.5"
          >
            <option value="audio">Áudio</option>
            <option value="image">Imagem</option>
            <option value="video">Vídeo</option>
            <option value="document">Documento</option>
          </select>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={onMoveUp} disabled={index === 0} aria-label="Mover pra cima">
            <ChevronUp size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={onMoveDown} disabled={index === totalCount - 1} aria-label="Mover pra baixo">
            <ChevronDown size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                  onClick={onRemove} disabled={totalCount === 1} aria-label="Remover">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Texto */}
      {item.kind === 'text' && (
        <>
          <Textarea
            ref={textareaRef}
            value={item.text_content ?? ''}
            onChange={e => onUpdate({ text_content: e.target.value })}
            placeholder="Digite a mensagem... Use {{nome}} para inserir o nome do lead."
            rows={3}
            className="resize-none"
          />
          <VariableChips
            variables={variables}
            targetRef={textareaRef}
            currentValue={item.text_content ?? ''}
            onChange={next => onUpdate({ text_content: next })}
          />
        </>
      )}

      {/* Mídia */}
      {item.kind !== 'text' && (
        <div className="space-y-2">
          {item.media_url ? (
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-2">
              {item.kind === 'image' && (
                <img src={item.media_url} alt="" className="w-12 h-12 object-cover rounded" />
              )}
              {item.kind === 'video' && (
                <video src={item.media_url} className="w-12 h-12 object-cover rounded" />
              )}
              {item.kind === 'audio' && (
                <audio src={item.media_url} controls className="flex-1" style={{ height: 28 }} />
              )}
              {item.kind === 'document' && (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <FileText size={20} className="text-orange-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {item.kind !== 'audio' && (
                  <p className="text-xs truncate">{item.media_filename}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onUpdate({ media_url: null, media_filename: null, pendingFile: null })}
                aria-label="Remover mídia"
              >
                <X size={14} />
              </Button>
            </div>
          ) : item.kind === 'audio' ? (
            recording ? (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-500 font-semibold">Gravando...</span>
                <span className="text-xs font-mono ml-auto text-muted-foreground">
                  {String(Math.floor(recordDur / 60)).padStart(2, '0')}:
                  {String(recordDur % 60).padStart(2, '0')}
                </span>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7"
                  onClick={stopRec}
                  aria-label="Parar gravação"
                >
                  <Square size={12} fill="currentColor" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={startRec}
                className="w-full justify-center gap-2 border-dashed"
              >
                <Mic size={14} /> Gravar áudio
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-center gap-2 border-dashed"
            >
              <Upload size={14} /> Anexar {KIND_LABELS[item.kind].toLowerCase()}
            </Button>
          )}

          {/* Legenda pra imagem/vídeo/doc */}
          {(item.kind === 'image' || item.kind === 'video' || item.kind === 'document') && item.media_url && (
            <>
              <Input
                ref={captionRef}
                type="text"
                value={item.media_caption ?? ''}
                onChange={e => onUpdate({ media_caption: e.target.value })}
                placeholder="Legenda (opcional)"
                maxLength={1024}
              />
              <VariableChips
                variables={variables}
                targetRef={captionRef}
                currentValue={item.media_caption ?? ''}
                onChange={next => onUpdate({ media_caption: next })}
              />
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={
              item.kind === 'image' ? 'image/*'
              : item.kind === 'video' ? 'video/*'
              : item.kind === 'audio' ? 'audio/*'
              : '*/*'
            }
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) selectFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Delay */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
        <Clock size={12} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Aguardar</span>
        <Input
          type="number"
          min={0}
          max={600}
          value={item.delay_seconds}
          onChange={e =>
            onUpdate({ delay_seconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })
          }
          className="w-16 h-7 text-xs text-center"
        />
        <span className="text-xs text-muted-foreground">segundos antes de enviar</span>
        {index === 0 && item.delay_seconds > 0 && (
          <div
            className="flex items-center gap-1 text-xs text-orange-500 ml-auto"
            title="1º item costuma ter delay 0"
          >
            <AlertCircle size={10} />
            <span>1º item</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Variable chips (insere {{token}} no cursor) ──────────────────────────────

interface VariableChipsProps {
  variables: TemplateVariable[];
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  currentValue: string;
  onChange: (next: string) => void;
}

function VariableChips({ variables, targetRef, currentValue, onChange }: VariableChipsProps) {
  const handleInsert = (token: string) => {
    const el = targetRef.current;
    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;
    const next = currentValue.slice(0, start) + token + currentValue.slice(end);
    onChange(next);
    // Re-foca e posiciona cursor após o token
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  if (variables.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Variáveis:
      </span>
      {variables.map(v => (
        <button
          key={v.token}
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => handleInsert(v.placeholder)}
          title={v.description ?? v.placeholder}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
        >
          <span className="font-semibold">{v.label}</span>
          <span className="font-mono text-muted-foreground">{v.placeholder}</span>
        </button>
      ))}
    </div>
  );
}

// ── Add item buttons ─────────────────────────────────────────────────────────

function AddItemButtons({ onAdd }: { onAdd: (kind: FunnelItemKind) => void }) {
  const kinds: FunnelItemKind[] = ['text', 'audio', 'image', 'video', 'document'];
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      <span className="text-xs text-muted-foreground flex items-center mr-1">+ Adicionar:</span>
      {kinds.map(k => {
        const Icon = KIND_ICONS[k];
        return (
          <Button
            key={k}
            variant="outline"
            size="sm"
            onClick={() => onAdd(k)}
            className="gap-1 h-7"
          >
            <Icon size={12} style={{ color: KIND_COLORS[k] }} />
            {KIND_LABELS[k]}
          </Button>
        );
      })}
    </div>
  );
}
