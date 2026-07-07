import React, { useState, useRef } from 'react';
import { Button, Input, Textarea } from '@/components/ui/ds';
import {
  X, Trash2, Type, Mic, Image as ImageIcon, Video, FileText,
  ChevronUp, ChevronDown, Square, Upload, Clock, AlertCircle, Loader2, Copy, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FunnelItemKind, TemplateVariable } from '@/types/messageFunnels';

// ─────────────────────────────────────────────────────────────────────────────
// Editor de SEQUÊNCIA de mensagens (itens text/audio/image/video/document).
// Componente ÚNICO reusado pelo Funil de Mensagens E pelo Disparo em Massa —
// regra: toda automação de WhatsApp do LM Flow usa o MESMO modal.
//
// Modos de upload (controlado pela prop `uploadMedia`):
//   - presente  → sobe o arquivo NA HORA e guarda `media_url` (Disparo: Evolution
//                 precisa de URL pública).
//   - ausente   → guarda `pendingFile` + preview local; o pai sobe depois de salvar
//                 (Funil: upload por item via /message_funnels/:id/items/:id/media).
// ─────────────────────────────────────────────────────────────────────────────

export interface SequenceDraftItem {
  uiKey: string;
  kind: FunnelItemKind;
  text_content: string | null;
  /** Variações EXTRAS do texto (além de text_content). No disparo, o backend
   *  sorteia UMA por destinatário entre [text_content, ...text_variations].
   *  Só usado em itens de texto. Vazio/ausente = comportamento antigo. */
  text_variations?: string[];
  media_url: string | null;
  media_filename: string | null;
  media_caption: string | null;
  delay_seconds: number;
  pendingFile: File | null;  // só no modo "upload diferido" (funil)
  serverItemId?: string;     // pra updates de item já existente no backend
}

export function newSequenceItem(kind: FunnelItemKind = 'text'): SequenceDraftItem {
  return {
    uiKey: crypto.randomUUID(),
    kind,
    text_content: kind === 'text' ? '' : null,
    media_url: null,
    media_filename: null,
    media_caption: null,
    delay_seconds: kind === 'delay' ? 30 : 0,
    pendingFile: null,
  };
}

const KIND_LABELS: Record<FunnelItemKind, string> = {
  text: 'Texto',
  audio: 'Áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  delay: 'Aguardar',
};
const KIND_ICONS: Record<FunnelItemKind, typeof Type> = {
  text: Type,
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
  delay: Clock,
};
const KIND_COLORS: Record<FunnelItemKind, string> = {
  text: '#7c3aed',
  audio: '#00a884',
  image: '#3b82f6',
  video: '#f43f5e',
  document: '#f97316',
  delay: '#64748b',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  items: SequenceDraftItem[];
  onChange: (items: SequenceDraftItem[]) => void;
  variables: TemplateVariable[];
  /** Presente = sobe o arquivo na hora e devolve a URL pública (modo Disparo). */
  uploadMedia?: (file: File) => Promise<{ url: string }>;
  /** Libera variações de texto (spintax). Só o Disparo em Massa persiste isso —
   *  funil/follow-up/agendamento NÃO, então fica escondido lá pra não perder em silêncio. */
  allowTextVariations?: boolean;
}

export default function MessageSequenceEditor({ items, onChange, variables, uploadMedia, allowTextVariations }: Props) {
  const updateItem = (uiKey: string, patch: Partial<SequenceDraftItem>) => {
    onChange(items.map(it => (it.uiKey === uiKey ? { ...it, ...patch } : it)));
  };

  const removeItem = (uiKey: string) => {
    onChange(items.length > 1 ? items.filter(it => it.uiKey !== uiKey) : items);
  };

  const moveItem = (uiKey: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(it => it.uiKey === uiKey);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  const addItem = (kind: FunnelItemKind = 'text') => {
    onChange([...items, newSequenceItem(kind)]);
  };

  const duplicateItem = (uiKey: string) => {
    const idx = items.findIndex(it => it.uiKey === uiKey);
    if (idx < 0) return;
    // Cópia logo abaixo do original. uiKey novo; serverItemId zerado pra o backend
    // criar um item novo (não sobrescrever o original ao salvar).
    const copy: SequenceDraftItem = { ...items[idx], uiKey: crypto.randomUUID(), serverItemId: undefined };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  return (
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
            uploadMedia={uploadMedia}
            allowTextVariations={allowTextVariations}
            onUpdate={patch => updateItem(it.uiKey, patch)}
            onRemove={() => removeItem(it.uiKey)}
            onDuplicate={() => duplicateItem(it.uiKey)}
            onMoveUp={() => moveItem(it.uiKey, 'up')}
            onMoveDown={() => moveItem(it.uiKey, 'down')}
          />
        ))}
      </div>
      <AddItemButtons onAdd={addItem} />
    </div>
  );
}

// ── Item editor (per-step) ───────────────────────────────────────────────────

interface ItemEditorProps {
  item: SequenceDraftItem;
  index: number;
  totalCount: number;
  variables: TemplateVariable[];
  uploadMedia?: (file: File) => Promise<{ url: string }>;
  allowTextVariations?: boolean;
  onUpdate: (patch: Partial<SequenceDraftItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ItemEditor({
  item, index, totalCount, variables, uploadMedia, allowTextVariations,
  onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
}: ItemEditorProps) {
  const Icon = KIND_ICONS[item.kind];
  const color = KIND_COLORS[item.kind];
  const [recording, setRecording] = useState(false);
  const [recordDur, setRecordDur] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  async function selectFile(file: File) {
    if (uploadMedia) {
      // Modo Disparo: sobe na hora e guarda a URL pública.
      if (file.size > 16 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx. 16MB).');
        return;
      }
      setUploading(true);
      onUpdate({ media_filename: file.name });
      try {
        const { url } = await uploadMedia(file);
        onUpdate({ media_url: url, media_filename: file.name, pendingFile: null });
      } catch {
        toast.error('Não consegui enviar o arquivo.');
        onUpdate({ media_filename: null });
      } finally {
        setUploading(false);
      }
    } else {
      // Modo Funil: guarda o arquivo + preview; o pai sobe depois de salvar.
      onUpdate({
        pendingFile: file,
        media_filename: file.name,
        media_url: URL.createObjectURL(file),
      });
    }
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
        void selectFile(file);
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
        {item.kind !== 'text' && item.kind !== 'delay' && (
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
          <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={onDuplicate} aria-label="Duplicar" title="Duplicar">
            <Copy size={14} />
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
          {allowTextVariations && (
            <TextVariations
              variations={item.text_variations ?? []}
              variables={variables}
              onChange={next => onUpdate({ text_variations: next })}
            />
          )}
        </>
      )}

      {/* Mídia */}
      {item.kind !== 'text' && item.kind !== 'delay' && (
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
          ) : uploading ? (
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Enviando arquivo...
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={startRec}
                  className="flex-1 justify-center gap-2 border-dashed"
                >
                  <Mic size={14} /> Gravar áudio
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 justify-center gap-2 border-dashed"
                >
                  <Upload size={14} /> Subir arquivo
                </Button>
              </div>
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
              if (f) void selectFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Item de espera: só aguarda N segundos antes do próximo item. */}
      {item.kind === 'delay' && (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Aguardar</span>
          <Input
            type="number"
            min={1}
            max={600}
            value={item.delay_seconds}
            onChange={e =>
              onUpdate({ delay_seconds: Math.max(1, Math.min(600, Number(e.target.value) || 1)) })
            }
            className="w-20 h-8 text-sm text-center"
          />
          <span className="text-xs text-muted-foreground">segundos antes do próximo</span>
          {index === 0 && (
            <div
              className="flex items-center gap-1 text-xs text-orange-500 ml-auto"
              title="Espera como 1º item não faz sentido"
            >
              <AlertCircle size={10} />
              <span>1º item</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Variações de texto (spintax) ─────────────────────────────────────────────
// O disparo sorteia UMA mensagem por lead entre a principal (text_content) e
// estas variações. Reduz "cara de robô" e risco de bloqueio no WhatsApp.

interface TextVariationsProps {
  variations: string[];
  variables: TemplateVariable[];
  onChange: (next: string[]) => void;
}

function TextVariations({ variations, variables, onChange }: TextVariationsProps) {
  const add = () => onChange([...variations, '']);
  const update = (i: number, val: string) => onChange(variations.map((v, idx) => (idx === i ? val : v)));
  const remove = (i: number) => onChange(variations.filter((_, idx) => idx !== i));

  return (
    <div className="mt-2 space-y-2">
      {variations.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Cada lead recebe UMA mensagem sorteada entre a principal e as variações abaixo.
        </p>
      )}
      {variations.map((v, i) => (
        <VariationField
          key={i}
          value={v}
          index={i}
          variables={variables}
          onChange={val => update(i, val)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="gap-1 h-7 border-dashed"
        title="Adicionar outra forma de escrever a mesma mensagem"
      >
        <Plus size={12} /> Variação
      </Button>
    </div>
  );
}

interface VariationFieldProps {
  value: string;
  index: number;
  variables: TemplateVariable[];
  onChange: (val: string) => void;
  onRemove: () => void;
}

function VariationField({ value, index, variables, onChange, onRemove }: VariationFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Variação {index + 2}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={onRemove}
          aria-label="Remover variação"
        >
          <X size={12} />
        </Button>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Outra forma de dizer a mesma coisa..."
        rows={2}
        className="resize-none"
      />
      <VariableChips variables={variables} targetRef={ref} currentValue={value} onChange={onChange} />
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
  const kinds: FunnelItemKind[] = ['text', 'audio', 'image', 'video', 'document', 'delay'];
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
