import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Badge } from '@evoapi/design-system';
import { MessageCircle, Loader2, RefreshCw } from 'lucide-react';
import MessageList from '@/components/chat/messages/MessageList';
import { useMessageHistory } from '@/hooks/chat/useMessageHistory';
import { contactsService } from '@/services/contacts/contactsService';
import type { ContactConversation } from '@/types/contacts';
import type { Message } from '@/types/chat/api';

interface ContactConversationTabProps {
  contactId: string;
}

const noop = () => {};
const noopAsync = async () => {};

function formatConvLabel(conv: ContactConversation): string {
  const ts = Date.parse(conv.last_activity_at || conv.created_at || '');
  const when = !isNaN(ts)
    ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '';
  const inbox = conv.inbox?.name ? conv.inbox.name : 'Conversa';
  return [inbox, when].filter(Boolean).join(' · ');
}

export default function ContactConversationTab({ contactId }: ContactConversationTabProps) {
  const [conversations, setConversations] = useState<ContactConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!contactId) return;
    setLoadingConvs(true);
    try {
      const res = await contactsService.getContactConversations(contactId);
      // Mais recente primeiro
      const sorted = [...res.data].sort((a, b) => {
        const ta = Date.parse(a.last_activity_at || a.created_at || '') || 0;
        const tb = Date.parse(b.last_activity_at || b.created_at || '') || 0;
        return tb - ta;
      });
      setConversations(sorted);
      setSelectedId(prev => prev ?? sorted[0]?.id ?? null);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvs(false);
    }
  }, [contactId]);

  useEffect(() => {
    setSelectedId(null);
    loadConversations();
  }, [contactId, loadConversations]);

  const {
    messages,
    hasMoreMessages,
    isLoadingMore,
    isInitialLoading,
    loadInitialMessages,
    loadMoreMessages,
    resetHistory,
  } = useMessageHistory({ conversationId: selectedId ?? '', enabled: !!selectedId });

  // Carrega todo o histórico da conversa selecionada (scroll infinito puxa o resto)
  useEffect(() => {
    if (selectedId) {
      resetHistory();
      loadInitialMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const messageList = useMemo(() => messages as Message[], [messages]);

  if (loadingConvs && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground opacity-50" />
        <p className="font-medium">Sem conversa ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Quando este contato trocar mensagens no WhatsApp (pelo sistema ou direto pelo celular),
          o histórico completo aparece aqui: texto, imagens, áudios e vídeos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '62vh' }}>
      {/* Seletor de conversa (quando há mais de uma) + refresh */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {conversations.length > 1 ? (
            conversations.map(conv => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedId(conv.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedId === conv.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {formatConvLabel(conv)}
                {conv.messages_count ? (
                  <span className="ml-1 opacity-60">({conv.messages_count})</span>
                ) : null}
              </button>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              {conversations[0] ? formatConvLabel(conversations[0]) : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">{messageList.length} msgs</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedId) {
                resetHistory();
                loadInitialMessages();
              }
            }}
            disabled={isInitialLoading}
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isInitialLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Histórico — mesma renderização do chat (texto, imagem, áudio, vídeo) */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-muted/20">
        <MessageList
          messages={messageList}
          hasMoreMessages={hasMoreMessages}
          isLoadingMore={isLoadingMore}
          isInitialLoading={isInitialLoading}
          onLoadMore={loadMoreMessages}
          onRetryMessage={noop}
          onReplyToMessage={noop}
          onCopyMessage={noop}
          onDeleteMessage={noopAsync}
        />
      </div>
    </div>
  );
}
