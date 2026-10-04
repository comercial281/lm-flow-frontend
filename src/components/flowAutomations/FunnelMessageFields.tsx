import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Paperclip } from 'lucide-react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowNodeConfig } from '@/types/flowAutomations';
import { cn } from '@/lib/utils';
import { VariableChipBar } from './VariableChipBar';

// A mensagem do funil de conversa (Automações · sprint 4): texto, foto, vídeo,
// documento, áudio, figurinha ou cartão de contato, no bloco "Mandar WhatsApp".
// O servidor manda pelo número da conversa em que a pessoa disparou.
//
// Trocar o tipo ZERA os campos do tipo anterior com texto vazio (e não apaga a
// chave): no modo guiado o servidor junta o que chega por cima do que está
// gravado, então chave que some não apagaria nada.

export type FunnelMessageKind = 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'contact';

export const FUNNEL_MESSAGE_KINDS: Array<{ value: FunnelMessageKind; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'image', label: 'Foto' },
  { value: 'video', label: 'Vídeo' },
  { value: 'document', label: 'Documento' },
  { value: 'audio', label: 'Áudio' },
  { value: 'sticker', label: 'Figurinha' },
  { value: 'contact', label: 'Contato' },
];

const MEDIA_KINDS: FunnelMessageKind[] = ['image', 'video', 'document', 'audio', 'sticker'];

const ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip',
  audio: 'audio/*',
  sticker: 'image/webp,image/png',
};

const PICK_LABEL: Record<string, string> = {
  image: 'Escolher foto',
  video: 'Escolher vídeo',
  document: 'Escolher documento',
  audio: 'Escolher áudio',
  sticker: 'Escolher figurinha',
};

/** O tipo da mensagem pelo que está no bloco. */
export function messageKindOf(config: FlowNodeConfig): FunnelMessageKind {
  const media = String(config.media_kind ?? '').trim();
  if (MEDIA_KINDS.includes(media as FunnelMessageKind)) return media as FunnelMessageKind;
  if (String(config.contact_phone ?? '').trim() || String(config.contact_name ?? '').trim()) return 'contact';
  return 'text';
}

/** O bloco tem mídia ou contato (o painel mostra o editor completo mesmo fora do funil de conversa). */
export function hasRichMessage(config: FlowNodeConfig): boolean {
  return messageKindOf(config) !== 'text' || String(config.media_url ?? '').trim() !== '';
}

/** O config com o tipo novo: o que era do tipo anterior fica em branco. */
export function withMessageKind(config: FlowNodeConfig, kind: FunnelMessageKind): FlowNodeConfig {
  const next: FlowNodeConfig = { ...config };
  const isMedia = MEDIA_KINDS.includes(kind);
  if (isMedia) {
    if (config.media_kind !== kind) {
      next.media_url = '';
      next.media_filename = '';
    }
    next.media_kind = kind;
  } else if ('media_kind' in config || 'media_url' in config) {
    next.media_kind = '';
    next.media_url = '';
    next.media_filename = '';
  }
  if (kind !== 'contact' && ('contact_name' in config || 'contact_phone' in config)) {
    next.contact_name = '';
    next.contact_phone = '';
  }
  if (kind === 'contact') {
    next.contact_name = String(config.contact_name ?? '');
    next.contact_phone = String(config.contact_phone ?? '');
  }
  return next;
}

const fileName = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || url);
  } catch {
    return url;
  }
};

function MediaPicker({ kind, config, onChange }: { kind: FunnelMessageKind; config: FlowNodeConfig; onChange: (next: FlowNodeConfig) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = String(config.media_url ?? '').trim();
  const name = String(config.media_filename ?? '').trim() || (url ? fileName(url) : '');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await flowAutomationsService.uploadMedia(file);
      onChange({ ...config, media_kind: kind, media_url: uploaded, media_filename: kind === 'document' ? file.name : '' });
    } catch {
      toast.error('Não deu pra enviar o arquivo. Tente de novo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Arquivo</Label>
      {url && (kind === 'image' || kind === 'sticker') && (
        <img src={url} alt="Prévia do arquivo escolhido" className="max-h-48 rounded-md border border-border object-contain" />
      )}
      {url && kind === 'video' && (
        <video src={url} controls className="max-h-48 w-full rounded-md border border-border" aria-label="Prévia do vídeo" />
      )}
      {url && kind === 'audio' && <audio src={url} controls className="w-full" aria-label="Prévia do áudio" />}
      {url && kind === 'document' && (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </div>
      )}
      {!url && <p className="text-xs text-muted-foreground">Nenhum arquivo escolhido ainda.</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        aria-label={PICK_LABEL[kind]}
        data-testid="arquivo-da-mensagem"
        onChange={e => void pick(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" /> : <Paperclip className="h-4 w-4 mr-1" aria-hidden="true" />}
        {uploading ? 'Enviando…' : url ? 'Trocar arquivo' : PICK_LABEL[kind]}
      </Button>
    </div>
  );
}

interface Props {
  config: FlowNodeConfig;
  onChange: (next: FlowNodeConfig) => void;
  /** Funil de conversa: a mensagem sai pelo número da conversa do disparo. */
  conversation?: boolean;
}

/** O editor da mensagem do funil: tipo, arquivo, texto/legenda com variáveis e contato. */
export function FunnelMessageFields({ config, onChange, conversation = false }: Props) {
  const [kind, setKind] = useState<FunnelMessageKind>(() => messageKindOf(config));
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const text = String(config.text ?? '');
  const isMedia = MEDIA_KINDS.includes(kind);
  const showText = kind === 'text' || kind === 'image' || kind === 'video' || kind === 'document';

  const changeKind = (next: FunnelMessageKind) => {
    setKind(next);
    onChange(withMessageKind(config, next));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Tipo de mensagem</Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de mensagem">
          {FUNNEL_MESSAGE_KINDS.map(k => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => changeKind(k.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                kind === k.value ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {isMedia && <MediaPicker kind={kind} config={config} onChange={onChange} />}

      {showText && (
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="flow-node-message">{kind === 'text' ? 'Mensagem' : 'Legenda (opcional)'}</Label>
          <p className="text-xs text-muted-foreground">
            Toque numa variável pra pôr o dado do lead no texto, onde o cursor estiver.
          </p>
          <Textarea
            id="flow-node-message"
            ref={messageRef}
            rows={kind === 'text' ? 8 : 3}
            className={kind === 'text' ? 'min-h-[180px]' : undefined}
            value={text}
            onChange={e => onChange({ ...config, text: e.target.value })}
            placeholder={kind === 'text' ? 'Oi {{nome}}, tudo bem?' : 'Olha só esse imóvel, {{nome}}!'}
          />
          <VariableChipBar targetRef={messageRef} value={text} onChange={next => onChange({ ...config, text: next })} />
        </div>
      )}

      {kind === 'contact' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="flow-node-contact-name">Nome do contato</Label>
            <Input
              id="flow-node-contact-name"
              value={String(config.contact_name ?? '')}
              onChange={e => onChange({ ...config, contact_name: e.target.value })}
              placeholder="Ana, do financiamento"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="flow-node-contact-phone">Telefone do contato</Label>
            <PhoneInput
              id="flow-node-contact-phone"
              value={String(config.contact_phone ?? '')}
              onChange={phone => onChange({ ...config, contact_phone: phone })}
              valueFormat="digits"
            />
          </div>
          <p className="text-xs text-muted-foreground">O lead recebe um cartão de contato que ele salva com um toque.</p>
        </div>
      )}

      {conversation && <p className="text-xs text-muted-foreground">Sai pelo número da conversa em que você disparar o funil.</p>}
    </div>
  );
}
