import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Textarea } from '@evoapi/design-system';
import { MessageCircle, Send, Loader2, RefreshCw, Paperclip, Rocket, Bell, X, Mic } from 'lucide-react';

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

async function transcribeAudioUrl(audioUrl: string): Promise<string> {
  const resp = await fetch(audioUrl);
  if (!resp.ok) throw new Error('Erro ao baixar áudio');
  const blob = await resp.blob();
  const ext = audioUrl.split('?')[0].split('.').pop() ?? 'ogg';
  const file = new File([blob], `audio.${ext}`, { type: blob.type || 'audio/ogg' });
  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error('Erro na transcrição');
  const data = await res.json();
  return data.text as string;
}
import { toast } from 'sonner';
import { conversationAPI } from '@/services/conversations/conversationService';
import MessageFunnelPopover from '@/components/chat/message-funnels/MessageFunnelPopover';
import type { PipelineItem } from '@/types/analytics';
import type { Message, Conversation } from '@/types/chat/api';

interface CardConversationTabProps {
  item: PipelineItem;
  onCreateReminder?: () => void;
}

const POLL_INTERVAL_MS = 10_000;

function formatTs(raw: string | number): string {
  const ts = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw));
  if (!ts || isNaN(ts)) return '';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function isPhoneNumber(s?: string | null): boolean {
  if (!s) return false;
  return /^[+\d\s\-()\u{0041}-\u{005A}]{0,3}[\d\s\-().]{6,}$/u.test(s.trim()) && /\d{6,}/.test(s);
}

function resolveContactName(item: PipelineItem): string | null {
  const candidates = [
    item.conversation?.contact?.name,
    item.contact?.name,
  ];
  for (const n of candidates) {
    if (n && !isPhoneNumber(n)) return n;
  }
  return null;
}

interface Attachment {
  url?: string;
  file_type?: string;
  thumb_url?: string;
  file_name?: string;
}

function AudioAttachment({ url }: { url: string }) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

  const handleTranscribe = async () => {
    if (!OPENAI_KEY) { setTranscription('Chave OpenAI não configurada.'); return; }
    setTranscribing(true);
    try {
      const text = await transcribeAudioUrl(url);
      setTranscription(text);
    } catch {
      setTranscription('Erro ao transcrever.');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="mt-1 space-y-1">
      <audio controls src={url} className="w-full max-w-xs" />
      {transcription ? (
        <div className="rounded-md bg-muted/60 px-2 py-1.5 text-xs text-foreground leading-relaxed">
          {transcription}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={transcribing}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          {transcribing ? 'Transcrevendo...' : 'Transcrever'}
        </button>
      )}
    </div>
  );
}

function MediaAttachment({ att }: { att: Attachment }) {
  const url = att.url ?? '';
  const ft = (att.file_type ?? '').toLowerCase();

  if (ft.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
    return (
      <img
        src={url}
        alt="imagem"
        className="mt-1 max-h-48 cursor-pointer rounded object-cover"
        onClick={() => window.open(url, '_blank')}
      />
    );
  }
  if (ft.startsWith('audio/') || /\.(mp3|ogg|webm|m4a|aac|opus)$/i.test(url)) {
    return <AudioAttachment url={url} />;
  }
  if (ft.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(url)) {
    return <video controls src={url} className="mt-1 max-h-48 w-full rounded" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs underline">
      {att.file_name ?? 'arquivo'}
    </a>
  );
}

function MessageBubble({ m, isOutgoing }: { m: Message; isOutgoing: boolean }) {
  const attachments = ((m.attachments ?? []) as Attachment[]);
  return (
    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
      isOutgoing ? 'bg-primary text-primary-foreground' : 'bg-card border'
    }`}>
      {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
      {attachments.map((att, i) => <MediaAttachment key={i} att={att} />)}
      {!m.content && attachments.length === 0 && (
        <em className="text-xs opacity-70">[mídia]</em>
      )}
      <div className={`mt-1 text-[10px] ${isOutgoing ? 'opacity-70' : 'text-muted-foreground'}`}>
        {formatTs(m.created_at)}
      </div>
    </div>
  );
}

export default function CardConversationTab({ item, onCreateReminder }: CardConversationTabProps) {
  // Carrega a conversa sempre que o card tiver uma — antes só carregava quando
  // item.type === 'conversation' (com item_id), então lead com conversa mas type
  // diferente vinha com 0 mensagens. Prioriza o id real da conversa.
  const conversationId =
    (item.conversation?.id ? String(item.conversation.id) : null) ??
    (item.type === 'conversation' ? item.item_id : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactName = resolveContactName(item);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      // getMessages já vem desembrulhado pra Message[] (extractData devolve
      // response.data.data). O código antigo lia res.data — que num array é
      // undefined — e zerava SEMPRE as mensagens (o famoso "0 mensagens").
      const raw = (await conversationAPI.getMessages(conversationId)) as unknown;
      const msgs: Message[] = Array.isArray(raw)
        ? (raw as Message[])
        : (((raw as { data?: Message[]; payload?: Message[] })?.data
            ?? (raw as { payload?: Message[] })?.payload) ?? []);
      setMessages(msgs);
    } catch {
      // silent — conversation may not exist yet
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    load();
    pollRef.current = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [conversationId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const doSend = async (content: string, files?: File[]) => {
    if (!conversationId) return;
    await conversationAPI.sendMessage(conversationId, {
      content,
      message_type: 'outgoing',
      attachments: files,
    });
    await load();
  };

  const send = async () => {
    if (!conversationId || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      await doSend(text.trim(), pendingFiles.length > 0 ? pendingFiles : undefined);
      setText('');
      setPendingFiles([]);
    } catch {
      toast.error('Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const handleSendMessage = async (opts: { content: string; files?: File[] }) => {
    await doSend(opts.content, opts.files);
  };

  // Cast item.conversation to Conversation — funnel popover só usa contact fields
  const convForFunnel = (item.conversation ?? null) as unknown as Conversation | null;

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Sem conversa ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Este card é um lead sem conversa WhatsApp. Quando ele responder pela primeira vez ou
          você enviar uma mensagem pela aba Atendimento, a conversa aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] flex-col">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {contactName && <span className="font-medium text-foreground">{contactName} · </span>}
          {messages.length} mensagem{messages.length === 1 ? '' : 's'} · atualiza a cada 10s
        </span>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* messages list */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map(m => {
            const mt: unknown = m.message_type;
            const isOutgoing = mt === 1 || mt === 'outgoing';
            const senderName = !isOutgoing
              ? (m.sender?.name && !isPhoneNumber(m.sender.name) ? m.sender.name : contactName)
              : null;
            return (
              <div key={m.id} className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
                {senderName && (
                  <span className="mb-0.5 px-1 text-[10px] text-muted-foreground">{senderName}</span>
                )}
                <MessageBubble m={m} isOutgoing={isOutgoing} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs">
              <span className="max-w-[6rem] truncate">{f.name}</span>
              <button
                onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* input area */}
      <div className="mt-2 flex gap-2">
        <div className="flex flex-1 flex-col gap-1 rounded-lg border bg-background px-2 pb-1 pt-1">
          {/* toolbar */}
          <div className="flex gap-0.5">
            <button
              type="button"
              title="Anexar arquivo (imagem, vídeo, áudio)"
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Funis de mensagem"
              onClick={() => setFunnelOpen(true)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Rocket className="h-4 w-4" />
            </button>
            {onCreateReminder && (
              <button
                type="button"
                title="Criar lembrete"
                onClick={onCreateReminder}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
              </button>
            )}
          </div>

          <Textarea
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Responder no WhatsApp..."
            className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        <Button
          onClick={send}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          size="default"
          className="self-end"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">
        Enter envia. Shift+Enter quebra linha.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={onFileChange}
      />

      <MessageFunnelPopover
        isOpen={funnelOpen}
        onClose={() => setFunnelOpen(false)}
        conversation={convForFunnel}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
