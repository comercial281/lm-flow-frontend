import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Badge } from '@/components/ui/ds';
import { MessageCircle, Loader2, RefreshCw, Archive, Inbox } from 'lucide-react';
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
  const [showArchived, setShowArchived] = useState(false);

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
      // Seleciona a primeira conversa ativa por padrão
      const firstActive = sorted.find(c => !c.custom_attributes?.archived);
      setSelectedId(prev => prev ?? firstActive?.id ?? sorted[0]?.id ?? null);
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

  const activeConvs = useMemo(
    () => conversations.filter(c => !c.custom_attributes?.archived),
    [conversations]
  );
  const archivedConvs = useMemo(
    () => conversations.filter(c => Boolean(c.custom_attributes?.archived)),
    [conversations]
  );
  const visibleConvs = showArchived ? archivedConvs : activeConvs;

  // Ao trocar aba ou carregar lista, seleciona a primeira da lista visível
  useEffect(() => {
    if (!selectedId && visibleConvs.length > 0) {
      setSelectedId(visibleConvs[0].id);
    }
  }, [selectedId, visibleConvs]);

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
      {/* Toggle Ativas / Arquivadas */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setShowArchived(false); setSelectedId(null); }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !showArchived
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <Inbox className="h-3 w-3" />
          Ativas
          {activeConvs.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              !showArchived ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {activeConvs.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setShowArchived(true); setSelectedId(null); }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            showArchived
              ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <Archive className="h-3 w-3" />
          Arquivadas
          {archivedConvs.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              showArchived
                ? 'bg-orange-200/60 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {archivedConvs.length}
            </span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Badge variant="secondary">{messageList.length} msgs</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedId) { resetHistory(); loadInitialMessages(); }
            }}
            disabled={isInitialLoading}
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isInitialLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Lista de conversas na visão selecionada */}
      {visibleConvs.length === 0 ? (
        <div className="mb-2 flex items-center justify-center rounded-lg border border-dashed py-4 text-xs text-muted-foreground">
          {showArchived ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa ativa'}
        </div>
      ) : (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {visibleConvs.length > 1 ? (
            visibleConvs.map(conv => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedId(conv.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedId === conv.id
                    ? showArchived
                      ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                      : 'border-primary bg-primary/10 text-foreground'
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
              {visibleConvs[0] ? formatConvLabel(visibleConvs[0]) : ''}
            </span>
          )}
        </div>
      )}

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
