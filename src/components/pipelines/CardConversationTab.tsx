import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Textarea } from '@evoapi/design-system';
import { MessageCircle, Send, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { conversationAPI } from '@/services/conversations/conversationService';
import type { PipelineItem } from '@/types/analytics';
import type { Message } from '@/types/chat/api';

interface CardConversationTabProps {
  item: PipelineItem;
}

const POLL_INTERVAL_MS = 10_000;

export default function CardConversationTab({ item }: CardConversationTabProps) {
  const conversationId = item.type === 'conversation' ? item.item_id : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await conversationAPI.getMessages(conversationId);
      // API may return either array or { payload: [] }
      const msgs = Array.isArray(res.data) ? res.data : (res.data as { payload?: Message[] }).payload ?? [];
      setMessages(msgs);
    } catch {
      // silent — provavelmente conversation_id ainda nao existe
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

  const send = async () => {
    if (!conversationId || !text.trim()) return;
    setSending(true);
    try {
      await conversationAPI.sendMessage(conversationId, {
        content: text.trim(),
        message_type: 'outgoing',
      });
      setText('');
      await load();
    } catch {
      toast.error('Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Sem conversa ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Este card é um lead sem conversa WhatsApp criada. Quando ele responder pela primeira vez ou você
          enviar uma msg pela aba Atendimento, a conversa aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] flex-col">
      {/* header com refresh */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
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
            const isOutgoing = m.message_type === 1 || m.message_type === 'outgoing';
            return (
              <div
                key={m.id}
                className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isOutgoing
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  }`}
                >
                  {m.content || <em className="text-xs opacity-70">[mídia]</em>}
                  <div className={`mt-1 text-[10px] ${isOutgoing ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {new Date((m.created_at as unknown as number) * 1000 || m.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="mt-2 flex gap-2">
        <Textarea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Responder no WhatsApp..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="default">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Enter envia. Shift+Enter quebra linha. Mídia (áudio/imagem/vídeo) ainda só pela aba Atendimento.
      </p>
    </div>
  );
}
