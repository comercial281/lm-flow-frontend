import React, { useState, useRef, type ReactNode } from 'react';
import { Button, Input, Textarea, Checkbox } from '@/components/ui/ds';
import {
  X, Trash2, Type, Mic, Image as ImageIcon, Video, FileText,
  ChevronUp, ChevronDown, Square, Upload, Clock, AlertCircle, Loader2, Copy, Plus,
  Contact as ContactIcon, Sticker, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FunnelItemKind, TemplateVariable } from '@/types/messageFunnels';
import { Seletor } from '@/components/base/Seletor';
import { BOOK_HELP } from '@/features/flowAutomations/book';

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
//
// Bloco Mensagem do construtor (PR 8 do redesenho, 16/10/2026) usa o mesmo
// editor com três ajustes opcionais, que os outros não passam:
//   - `extraKinds`: tipos a mais. Hoje só o book do imóvel (`property_book`).
//   - `variableBar`: a barra de variáveis do construtor no lugar da de dentro.
//   - `guided`: modo guiado (o corretor só ajusta o que o gestor montou).
// ─────────────────────────────────────────────────────────────────────────────

/** Os tipos do funil mais o book do imóvel, que só o bloco Mensagem oferece. */
export type SequenceItemKind = FunnelItemKind | 'property_book';

/** Tipo extra que só aparece quando o chamador pede (`extraKinds`). */
export type ExtraSequenceKind = Exclude<SequenceItemKind, FunnelItemKind>;

/** Afunila pros tipos do funil: quem converte pra API do funil/disparo/agendamento usa. */
export const isFunnelItemKind = (kind: SequenceItemKind): kind is FunnelItemKind => kind !== 'property_book';

export interface SequenceDraftItem {
  uiKey: string;
  kind: SequenceItemKind;
  text_content: string | null;
  /** Variações EXTRAS do texto (além de text_content). No disparo, o backend
   *  sorteia UMA por destinatário entre [text_content, ...text_variations].
   *  Só usado em itens de texto. Vazio/ausente = comportamento antigo. */
  text_variations?: string[];
  media_url: string | null;
  media_filename: string | null;
  media_caption: string | null;
  delay_seconds: number;
  /** contact_name/contact_phone (item 'contact'), random_interval/min_seconds/
   *  max_seconds (item 'delay' com pausa sorteada) — mirror do config jsonb
   *  do MessageFunnelItem. */
  config: Record<string, unknown>;
  pendingFile: File | null;  // só no modo "upload diferido" (funil)
  serverItemId?: string;     // pra updates de item já existente no backend
}

export function newSequenceItem(kind: SequenceItemKind = 'text'): SequenceDraftItem {
  return {
    uiKey: crypto.randomUUID(),
    kind,
    text_content: kind === 'text' ? '' : null,
    media_url: null,
    media_filename: null,
    media_caption: null,
    delay_seconds: kind === 'delay' ? 30 : 0,
    config: {},
    pendingFile: null,
  };
}

const KIND_LABELS: Record<SequenceItemKind, string> = {
  text: 'Texto',
  audio: 'Áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  delay: 'Aguardar',
  contact: 'Contato',
  sticker: 'Figurinha',
  property_book: 'Book do imóvel',
};
const KIND_ICONS: Record<SequenceItemKind, typeof Type> = {
  text: Type,
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
  delay: Clock,
  contact: ContactIcon,
  sticker: Sticker,
  property_book: BookOpen,
};
const KIND_COLORS: Record<SequenceItemKind, string> = {
  text: '#7c3aed',
  audio: '#00a884',
  image: '#3b82f6',
  video: '#f43f5e',
  document: '#f97316',
  delay: '#64748b',
  contact: '#0891b2',
  sticker: '#f59e0b',
  property_book: '#4f46e5',
};

const MEDIA_KINDS: SequenceItemKind[] = ['audio', 'image', 'video', 'document', 'sticker'];
const isMediaKind = (kind: SequenceItemKind) => MEDIA_KINDS.includes(kind);
/** Mídias que levam legenda. */
const CAPTION_KINDS: SequenceItemKind[] = ['image', 'video', 'document'];

/** Barra de variáveis de quem chama (o construtor tem a dele). */
export type VariableBarRender = (p: {
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) => ReactNode;

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
  /** Tipos que o chamador NÃO sabe entregar ainda — somem do "+ Adicionar".
   *  Ex.: Disparo em Massa ainda não manda contato/figurinha em lote. */
  excludeKinds?: FunnelItemKind[];
  /** Tipos a mais no "+ Adicionar". `property_book`: o book do imóvel do lead,
   *  que o servidor acha sozinho; o cartão só tem a legenda. */
  extraKinds?: ExtraSequenceKind[];
  /** Presente = desenha esta barra no lugar das variáveis de dentro (texto,
   *  legenda e variações). */
  variableBar?: VariableBarRender;
  /** Modo guiado: sem "+ Adicionar", duplicar e mover. A mensagem pode trocar de
   *  tipo; a espera não sai nem troca de tipo, só o tempo muda. A última
   *  mensagem também não sai (o servidor recusaria). */
  guided?: boolean;
}

export default function MessageSequenceEditor({
  items, onChange, variables, uploadMedia, allowTextVariations, excludeKinds, extraKinds, variableBar, guided,
}: Props) {
  // A lista e o onChange mais novos. O arquivo que termina de subir chega
  // depois de outras edições: aplicar sobre a lista de quando ele foi escolhido
  // apagaria o que foi digitado nos outros itens enquanto ele subia.
  const latest = useRef({ items, onChange });
  latest.current = { items, onChange };

  const updateItem = (uiKey: string, patch: Partial<SequenceDraftItem>) => {
    const next = latest.current.items.map(it => (it.uiKey === uiKey ? { ...it, ...patch } : it));
    // Duas mudanças antes do pai desenhar de novo não se atropelam.
    latest.current = { ...latest.current, items: next };
    latest.current.onChange(next);
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

  const addItem = (kind: SequenceItemKind = 'text') => {
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

  const messageCount = items.filter(it => it.kind !== 'delay').length;
  // No guiado a mensagem pode virar qualquer tipo de mensagem que esta tela oferece.
  const switchKinds = guided ? offeredKinds(excludeKinds, extraKinds).filter(k => k !== 'delay') : undefined;

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-2">
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
            variableBar={variableBar}
            guided={guided}
            switchKinds={switchKinds}
            showRemove={!(guided && it.kind === 'delay')}
            canRemove={items.length > 1 && !(guided && messageCount === 1)}
            onUpdate={patch => updateItem(it.uiKey, patch)}
            onRemove={() => removeItem(it.uiKey)}
            onDuplicate={() => duplicateItem(it.uiKey)}
            onMoveUp={() => moveItem(it.uiKey, 'up')}
            onMoveDown={() => moveItem(it.uiKey, 'down')}
          />
        ))}
      </div>
      {!guided && <AddItemButtons onAdd={addItem} kinds={offeredKinds(excludeKinds, extraKinds)} />}
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
  variableBar?: VariableBarRender;
  guided?: boolean;
  /** Tipos pra onde a mensagem pode trocar (só no guiado). */
  switchKinds?: SequenceItemKind[];
  showRemove: boolean;
  canRemove: boolean;
  onUpdate: (patch: Partial<SequenceDraftItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ItemEditor({
  item, index, totalCount, variables, uploadMedia, allowTextVariations, variableBar, guided, switchKinds,
  showRemove, canRemove, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
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
  const isMedia = isMediaKind(item.kind);
  // Fora do guiado, só a mídia troca de tipo (entre mídias), como sempre.
  const kindOptions: SequenceItemKind[] = switchKinds
    ? (switchKinds.includes(item.kind) ? switchKinds : [item.kind, ...switchKinds])
    : isMedia ? MEDIA_KINDS : [];

  // Variáveis embaixo de uma caixa: a barra de quem chama, ou a de dentro.
  const vars = (
    targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    value: string,
    change: (next: string) => void,
  ) =>
    variableBar
      ? variableBar({ targetRef, value, onChange: change })
      : <VariableChips variables={variables} targetRef={targetRef} currentValue={value} onChange={change} />;

  // Troca de tipo. Entre mídias, como sempre: some o arquivo e fica a legenda.
  // Entre famílias (texto, contato, book, mídia), só no guiado: começa vazio,
  // menos o texto que vira foto, vídeo ou documento: ele passa a ser a legenda.
  function switchKind(kind: SequenceItemKind) {
    if (isMedia && isMediaKind(kind)) {
      onUpdate({ kind, media_url: null, media_filename: null, pendingFile: null });
      return;
    }
    const caption = item.kind === 'text' && CAPTION_KINDS.includes(kind) ? item.text_content || null : null;
    onUpdate({
      kind,
      text_content: kind === 'text' ? '' : null,
      media_url: null,
      media_filename: null,
      media_caption: caption,
      config: {},
      pendingFile: null,
    });
  }

  async function selectFile(file: File) {
    if (uploadMedia) {
      // Modo Disparo: sobe na hora e guarda a URL pública.
      // 200MB: WhatsApp entrega documento grande (book de imóvel passa de 16MB).
      const MAX_UPLOAD_MB = 200;
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`Arquivo muito grande (máx. ${MAX_UPLOAD_MB}MB).`);
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
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{KIND_LABELS[item.kind]}</span>
        </div>
        {item.kind !== 'delay' && kindOptions.length > 0 && (
          <Seletor
            aria-label="Tipo do item"
            value={item.kind}
            onChange={e => switchKind(e.target.value as SequenceItemKind)}
            className="h-auto w-28 text-xs bg-background border border-border rounded px-1.5 py-0.5"
          >
            {kindOptions.map(k => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </Seletor>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {!guided && (
            <>
              <Button variant="ghost" size="icon" className="size-8"
                      onClick={onMoveUp} disabled={index === 0} aria-label="Mover pra cima">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8"
                      onClick={onMoveDown} disabled={index === totalCount - 1} aria-label="Mover pra baixo">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8"
                      onClick={onDuplicate} aria-label="Duplicar" title="Duplicar">
                <Copy className="h-4 w-4" />
              </Button>
            </>
          )}
          {showRemove && (
            <Button variant="ghost" size="icon" className="size-8 text-destructive"
                    onClick={onRemove} disabled={!canRemove} aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Texto */}
      {item.kind === 'text' && (
        <>
          <Textarea
            ref={textareaRef}
            aria-label="Mensagem"
            value={item.text_content ?? ''}
            onChange={e => onUpdate({ text_content: e.target.value })}
            placeholder="Digite a mensagem... Use {{nome}} para inserir o nome do lead."
            rows={3}
            className="resize-none"
          />
          {vars(textareaRef, item.text_content ?? '', next => onUpdate({ text_content: next }))}
          {allowTextVariations && (
            <TextVariations
              variations={item.text_variations ?? []}
              variables={variables}
              variableBar={variableBar}
              onChange={next => onUpdate({ text_variations: next })}
            />
          )}
        </>
      )}

      {/* Contato */}
      {item.kind === 'contact' && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Nome do contato"
            value={(item.config.contact_name as string) || ''}
            onChange={e => onUpdate({ config: { ...item.config, contact_name: e.target.value } })}
          />
          <Input
            placeholder="Telefone (com DDI)"
            value={(item.config.contact_phone as string) || ''}
            onChange={e => onUpdate({ config: { ...item.config, contact_phone: e.target.value } })}
          />
        </div>
      )}

      {/* Book do imóvel: o servidor acha o arquivo; aqui só a legenda. */}
      {item.kind === 'property_book' && (
        <div className="space-y-1.5">
          <Input
            ref={captionRef}
            type="text"
            value={item.media_caption ?? ''}
            onChange={e => onUpdate({ media_caption: e.target.value })}
            placeholder="Legenda (opcional)"
            maxLength={1024}
          />
          {vars(captionRef, item.media_caption ?? '', next => onUpdate({ media_caption: next }))}
          <p className="text-xs text-muted-foreground">{BOOK_HELP}</p>
        </div>
      )}

      {/* Mídia */}
      {isMedia && (
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
                  <FileText className="h-5 w-5 text-orange-500" />
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
                className="size-8 text-destructive"
                onClick={() => onUpdate({ media_url: null, media_filename: null, pendingFile: null })}
                aria-label="Remover mídia"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : uploading ? (
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando arquivo...
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
                  className="size-8"
                  onClick={stopRec}
                  aria-label="Parar gravação"
                >
                  <Square className="h-4 w-4" fill="currentColor" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={startRec}
                  className="flex-1 justify-center gap-2 border-dashed"
                >
                  <Mic className="h-4 w-4" /> Gravar áudio
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 justify-center gap-2 border-dashed"
                >
                  <Upload className="h-4 w-4" /> Subir arquivo
                </Button>
              </div>
            )
          ) : (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-center gap-2 border-dashed"
            >
              <Upload className="h-4 w-4" /> Anexar {KIND_LABELS[item.kind].toLowerCase()}
            </Button>
          )}

          {/* Legenda pra imagem/vídeo/doc */}
          {CAPTION_KINDS.includes(item.kind) && item.media_url && (
            <>
              <Input
                ref={captionRef}
                type="text"
                value={item.media_caption ?? ''}
                onChange={e => onUpdate({ media_caption: e.target.value })}
                placeholder="Legenda (opcional)"
                maxLength={1024}
              />
              {vars(captionRef, item.media_caption ?? '', next => onUpdate({ media_caption: next }))}
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
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={Boolean(item.config.random_interval)}
              onCheckedChange={v => onUpdate({ config: { ...item.config, random_interval: v === true } })}
            />
            Sortear um tempo aleatório em vez de fixo
          </label>
          {item.config.random_interval ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Entre</span>
              <Input
                type="number" min={0} max={120} className="w-16 h-8 text-sm text-center"
                value={(item.config.min_seconds as number) ?? 0}
                onChange={e => onUpdate({ config: { ...item.config, min_seconds: Number(e.target.value) || 0 } })}
              />
              <span className="text-xs text-muted-foreground">e</span>
              <Input
                type="number" min={0} max={120} className="w-16 h-8 text-sm text-center"
                value={(item.config.max_seconds as number) ?? 0}
                onChange={e => onUpdate({ config: { ...item.config, max_seconds: Number(e.target.value) || 0 } })}
              />
              <span className="text-xs text-muted-foreground">segundos (sorteado a cada envio)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
            </div>
          )}
          {index === 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-500" title="Espera como 1º item não faz sentido">
              <AlertCircle className="h-3.5 w-3.5" />
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
  variableBar?: VariableBarRender;
  onChange: (next: string[]) => void;
}

function TextVariations({ variations, variables, variableBar, onChange }: TextVariationsProps) {
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
          variableBar={variableBar}
          onChange={val => update(i, val)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="gap-1 border-dashed"
        title="Adicionar outra forma de escrever a mesma mensagem"
      >
        <Plus className="h-4 w-4" /> Variação
      </Button>
    </div>
  );
}

interface VariationFieldProps {
  value: string;
  index: number;
  variables: TemplateVariable[];
  variableBar?: VariableBarRender;
  onChange: (val: string) => void;
  onRemove: () => void;
}

function VariationField({ value, index, variables, variableBar, onChange, onRemove }: VariationFieldProps) {
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
          className="size-8 text-destructive"
          onClick={onRemove}
          aria-label="Remover variação"
        >
          <X className="h-4 w-4" />
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
      {variableBar
        ? variableBar({ targetRef: ref, value, onChange })
        : <VariableChips variables={variables} targetRef={ref} currentValue={value} onChange={onChange} />}
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

const ALL_KINDS: FunnelItemKind[] = ['text', 'audio', 'image', 'video', 'document', 'delay', 'contact', 'sticker'];

/** O que esta tela oferece: os tipos do funil menos os excluídos, mais os extras. */
function offeredKinds(excludeKinds?: FunnelItemKind[], extraKinds?: ExtraSequenceKind[]): SequenceItemKind[] {
  const kinds: SequenceItemKind[] = excludeKinds?.length ? ALL_KINDS.filter(k => !excludeKinds.includes(k)) : ALL_KINDS;
  return extraKinds?.length ? [...kinds, ...extraKinds] : kinds;
}

function AddItemButtons({ onAdd, kinds }: { onAdd: (kind: SequenceItemKind) => void; kinds: SequenceItemKind[] }) {
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
            className="gap-1"
          >
            <Icon className="h-4 w-4" style={{ color: KIND_COLORS[k] }} />
            {KIND_LABELS[k]}
          </Button>
        );
      })}
    </div>
  );
}
