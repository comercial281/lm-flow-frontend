import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@evoapi/design-system/button';
import { Input } from '@evoapi/design-system/input';
import { Badge } from '@evoapi/design-system/badge';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@evoapi/design-system/context-menu';
import {
  Search,
  Filter,
  Mail,
  MailOpen,
  MessageCircle,
  CheckCircle,
  Clock,
  Pause,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  User as UserIcon,
  Users,
  Tag,
  Trash2,
  X,
  FileText,
  Pin,
  Archive,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useChatContext } from '@/contexts/chat/ChatContext';
import { Conversation, ConversationFilter } from '@/types/chat/api';
import { formatConversationTime, formatDetailedTime } from '@/utils/time/timeHelpers';
import { ConversationSkeleton } from '../loading-states';
import { NoConversations } from '../empty-states';
import ContactAvatar from '../contact/ContactAvatar';
import ConversationBadges from '../conversation/ConversationBadges';
import ConversationsFilter from '../conversation/ConversationsFilter';
import GlobalSearchPanel from '../search/GlobalSearchPanel';
import { BaseFilter } from '@/types/core';
import InboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { useLanguage } from '@/hooks/useLanguage';
import { useDebounce } from '@/hooks/useDebounce';
import chatService from '@/services/chat/chatService';
import type {
  SearchConversationResult,
  SearchContactResult,
  SearchMessageResult,
} from '@/types/chat/search';

interface ChatSidebarProps {
  mobileView: 'list' | 'chat';
  searchInput: string;
  onSearchChange: (value: string) => void;
  onConversationSelect: (conversation: Conversation) => void;
  onFilterApply: (filters: BaseFilter[]) => void;
  onFilterClear: () => void;
  onMarkAsRead: (conversation: Conversation) => void;
  onMarkAsUnread: (conversation: Conversation) => void;
  onMarkAsOpen: (conversation: Conversation) => void;
  onMarkAsResolved: (conversation: Conversation) => void;
  onPostpone: (conversation: Conversation) => void;
  onMarkAsSnoozed: (conversation: Conversation) => void;
  onSetPriority: (
    conversation: Conversation,
    priority: 'low' | 'medium' | 'high' | 'urgent' | null,
  ) => void;
  onPinConversation: (conversation: Conversation) => void;
  onUnpinConversation: (conversation: Conversation) => void;
  onArchiveConversation: (conversation: Conversation) => void;
  onUnarchiveConversation: (conversation: Conversation) => void;
  onAssignAgent: (conversation: Conversation) => void;
  onAssignTeam: (conversation: Conversation) => void;
  onAssignTag: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
}

function getUrgencyColor(timestamp: number | string | undefined): string {
  if (!timestamp) return 'transparent';
  const ts = typeof timestamp === 'number' ? timestamp : Date.parse(String(timestamp));
  if (Number.isNaN(ts)) return 'transparent';
  const hours = (Date.now() - ts) / 3_600_000;
  if (hours < 1) return '#10b981';
  if (hours < 4) return '#f59e0b';
  return '#ef4444';
}

const ChatSidebar = ({
  mobileView,
  searchInput,
  onSearchChange,
  onConversationSelect,
  onFilterApply,
  onFilterClear,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkAsOpen,
  onMarkAsResolved,
  onPostpone,
  onMarkAsSnoozed,
  onSetPriority,
  onPinConversation,
  onUnpinConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onAssignAgent,
  onAssignTeam,
  onAssignTag,
  onDeleteConversation,
}: ChatSidebarProps) => {
  const { t } = useLanguage('chat');
  const chatContext = useChatContext();
  const conversations = chatContext.conversations as typeof chatContext.conversations & {
    state: {
      conversations: Conversation[];
      conversationsLoading: boolean;
      conversationsError: string | null;
      selectedConversationId: string | null;
      conversationsPagination: {
        page?: number;
        total?: number;
        total_pages?: number;
        has_next_page?: boolean;
      } | null;
    };
    getUnreadCount: (conversationId: string) => number;
    loadConversations: (params?: unknown) => Promise<void>;
    loadMoreConversations: () => Promise<void>;
  };
  const filters = chatContext.filters;
  const [conversationFilters, setConversationFilters] = useState<BaseFilter[]>([]);
  // Instâncias (inboxes/WhatsApp) do tenant — pro seletor rápido de instância.
  const [inboxOptions, setInboxOptions] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    let alive = true;
    InboxesService.list()
      .then((res) => {
        if (!alive) return;
        setInboxOptions(
          (res.data ?? []).map((i: Inbox) => {
            const ch = i.channel_type?.split('::')[1] || '';
            return { id: String(i.id), label: ch ? `${i.name} (${ch})` : i.name };
          }),
        );
      })
      .catch(() => { /* silencioso */ });
    return () => { alive = false; };
  }, []);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const currentLocal = JSON.stringify(conversationFilters);
    const currentContext = JSON.stringify(
      filters.state.activeFilters.map((f: ConversationFilter) => ({
        attributeKey: f.attribute_key,
        filterOperator: f.filter_operator,
        values: Array.isArray(f.values) ? f.values.join(',') : String(f.values[0] || ''),
        queryOperator: f.query_operator,
        attributeModel: 'standard' as const,
      })),
    );

    if (currentLocal !== currentContext) {
      setConversationFilters(
        filters.state.activeFilters.map((f: ConversationFilter) => ({
          attributeKey: f.attribute_key,
          filterOperator: f.filter_operator,
          values: Array.isArray(f.values) ? f.values.join(',') : String(f.values[0] || ''),
          queryOperator: f.query_operator,
          attributeModel: 'standard' as const,
        })),
      );
    }
  }, [filters.state.activeFilters, conversationFilters]);

  const navigate = useNavigate();
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const debouncedSearchTerm = useDebounce(searchInput, 500);

  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    if (value.trim().length > 0) {
      setIsSearchPanelOpen(true);
    }
  };

  const handleSearchFocus = () => {
    if (searchInput.trim().length > 0) {
      setIsSearchPanelOpen(true);
    }
  };

  const handleSelectConversation = useCallback(
    (item: SearchConversationResult) => {
      navigate(`/conversations/${item.id}`);
      onSearchChange('');
      setIsSearchPanelOpen(false);
    },
    [navigate, onSearchChange],
  );

  const handleSelectContact = useCallback(
    (item: SearchContactResult) => {
      navigate(`/contacts/${item.id}`);
      onSearchChange('');
      setIsSearchPanelOpen(false);
    },
    [navigate, onSearchChange],
  );

  const handleSelectMessage = useCallback(
    async (item: SearchMessageResult) => {
      setIsSearchPanelOpen(false);
      onSearchChange('');

      if (item.conversation_id == null) return;

      try {
        const raw = await chatService.getConversation(String(item.conversation_id));
        const envelope = raw as { data?: { uuid?: string; id?: string }; uuid?: string; id?: string } | null;
        const conv = envelope?.data?.id ? envelope.data : envelope;
        const uuid = conv?.uuid || conv?.id;
        if (uuid) {
          navigate(`/conversations/${uuid}`, {
            state: { scrollToMessageId: item.id },
          });
        }
      } catch (error) {
        console.error('Failed to load conversation from message result:', error);
      }
    },
    [navigate, onSearchChange],
  );

  const handleApplyFilters = async (newFilters: BaseFilter[]) => {
    setConversationFilters(newFilters);
    onFilterApply(newFilters);
  };

  const handleClearFilters = async () => {
    setConversationFilters([]);
    onFilterClear();
  };

  // Seletor rápido de instância: aplica/remove um filtro inbox_id.
  const selectedInboxId = String(
    conversationFilters.find((f) => f.attributeKey === 'inbox_id')?.values ?? '',
  );
  const applyInstanceFilter = (inboxId: string) => {
    const others = conversationFilters.filter((f) => f.attributeKey !== 'inbox_id');
    const next: BaseFilter[] = inboxId
      ? [
          ...others,
          {
            attributeKey: 'inbox_id',
            filterOperator: 'equal_to',
            values: inboxId,
            queryOperator: 'and',
            attributeModel: 'standard',
          },
        ]
      : others;
    handleApplyFilters(next);
  };

  const handleBulkResolve = async () => {
    const count = selectedConversations.size;
    try {
      await chatService.bulkAction({
        type: 'Conversation',
        ids: Array.from(selectedConversations),
        fields: { status: 'resolved' },
      });
      setSelectedConversations(new Set());
      await conversations.loadConversations({});
      toast.success(`${count} conversa${count !== 1 ? 's' : ''} resolvida${count !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Bulk resolve error:', error);
      toast.error('Erro ao resolver conversas');
    }
  };

  const pagination = conversations.state.conversationsPagination;
  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  const hasNextPage = pagination?.has_next_page ?? currentPage < totalPages;

  const handleSidebarScroll = useCallback(async () => {
    const container = sidebarScrollRef.current;
    if (!container || loadingMoreRef.current) return;

    const pagination = conversations.state.conversationsPagination;
    if (!pagination) return;

    const currentPage = pagination.page || 1;
    const totalPages = pagination.total_pages || 1;
    const hasNextPage = pagination.has_next_page ?? currentPage < totalPages;
    if (!hasNextPage) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom > 120) return;

    loadingMoreRef.current = true;
    setIsLoadingMoreConversations(true);
    try {
      await conversations.loadMoreConversations();
    } finally {
      setIsLoadingMoreConversations(false);
      loadingMoreRef.current = false;
    }
  }, [conversations]);

  const handleLoadMoreClick = useCallback(async () => {
    if (loadingMoreRef.current || isLoadingMoreConversations || !hasNextPage) return;

    loadingMoreRef.current = true;
    setIsLoadingMoreConversations(true);
    try {
      await conversations.loadMoreConversations();
    } finally {
      setIsLoadingMoreConversations(false);
      loadingMoreRef.current = false;
    }
  }, [conversations, hasNextPage, isLoadingMoreConversations]);

  const visibleConversations = useMemo(() => {
    const filtered = conversations.state.conversations.filter(conversation => {
      const isArchived = Boolean(conversation.custom_attributes?.archived);
      return showArchived ? isArchived : !isArchived;
    });

    const getSortTimestamp = (conversation: Conversation) => {
      if (typeof conversation.timestamp === 'number') {
        return conversation.timestamp;
      }
      const activityTime = Date.parse(conversation.last_activity_at || '');
      if (!Number.isNaN(activityTime)) {
        return activityTime;
      }
      const updatedTime = Date.parse(conversation.updated_at || '');
      if (!Number.isNaN(updatedTime)) {
        return updatedTime;
      }
      const createdTime = Date.parse(conversation.created_at || '');
      if (!Number.isNaN(createdTime)) {
        return createdTime;
      }
      return 0;
    };

    return [...filtered].sort((a, b) => {
      const aPinned = Boolean(a.custom_attributes?.pinned);
      const bPinned = Boolean(b.custom_attributes?.pinned);
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }
      return getSortTimestamp(b) - getSortTimestamp(a);
    });
  }, [conversations.state.conversations, showArchived]);

  const stripHtml = (html: string): string => {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return (tempDiv.textContent || tempDiv.innerText || '').trim();
  };

  const getLastMessage = (conversation: Conversation) => {
    const msg = conversation.last_non_activity_message;
    const cleanContent = stripHtml(msg?.processed_message_content || msg?.content || '');
    return cleanContent.length > 60 ? cleanContent.substring(0, 60) + '...' : cleanContent;
  };

  const renderConversationContextMenu = (conversation: Conversation, children: React.ReactNode) => {
    const currentStatus = conversation.status;
    const hasUnreadMessages =
      (conversations.getUnreadCount(conversation.id) ?? conversation.unread_count ?? 0) > 0;
    const isPinned = Boolean(conversation.custom_attributes?.pinned);
    const isArchived = Boolean(conversation.custom_attributes?.archived);

    return (
      <ContextMenu key={conversation.id}>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {hasUnreadMessages ? (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onMarkAsRead(conversation); }}
              className="flex items-center gap-2"
            >
              <MailOpen className="h-4 w-4" />
              {t('chatHeader.actions.markAsRead')}
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onMarkAsUnread(conversation); }}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              {t('chatHeader.actions.markAsUnread')}
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {currentStatus !== 'open' && (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onMarkAsOpen(conversation); }}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              {t('chatHeader.actions.markAsOpen')}
            </ContextMenuItem>
          )}

          {currentStatus !== 'resolved' && (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onMarkAsResolved(conversation); }}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {t('chatHeader.actions.markAsResolved')}
            </ContextMenuItem>
          )}

          {currentStatus !== 'pending' && (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onPostpone(conversation); }}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {t('chatHeader.actions.markAsPending')}
            </ContextMenuItem>
          )}

          {currentStatus !== 'snoozed' && (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onMarkAsSnoozed(conversation); }}
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              {t('chatHeader.actions.pauseConversation')}
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onSetPriority(conversation, 'urgent'); }}
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-red-600" />
            {t('chatHeader.actions.priorityUrgent')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onSetPriority(conversation, 'high'); }}
            className="flex items-center gap-2"
          >
            <ArrowUp className="h-4 w-4 text-orange-600" />
            {t('chatHeader.actions.priorityHigh')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onSetPriority(conversation, 'medium'); }}
            className="flex items-center gap-2"
          >
            <Minus className="h-4 w-4 text-blue-600" />
            {t('chatHeader.actions.priorityMedium')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onSetPriority(conversation, 'low'); }}
            className="flex items-center gap-2"
          >
            <ArrowDown className="h-4 w-4 text-gray-600" />
            {t('chatHeader.actions.priorityLow')}
          </ContextMenuItem>

          {conversation.priority && (
            <ContextMenuItem
              onClick={e => { e.stopPropagation(); onSetPriority(conversation, null); }}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              {t('chatHeader.actions.removePriority')}
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={e => {
              e.stopPropagation();
              if (isPinned) { onUnpinConversation(conversation); } else { onPinConversation(conversation); }
            }}
            className="flex items-center gap-2"
          >
            <Pin className="h-4 w-4" />
            {isPinned ? t('chatHeader.actions.unpinConversation') : t('chatHeader.actions.pinConversation')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => {
              e.stopPropagation();
              if (isArchived) { onUnarchiveConversation(conversation); } else { onArchiveConversation(conversation); }
            }}
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            {isArchived ? t('chatHeader.actions.unarchiveConversation') : t('chatHeader.actions.archiveConversation')}
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onAssignAgent(conversation); }}
            className="flex items-center gap-2"
          >
            <UserIcon className="h-4 w-4" />
            {t('chatHeader.actions.assignAgent')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onAssignTeam(conversation); }}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            {t('chatHeader.actions.assignTeam')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onAssignTag(conversation); }}
            className="flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            {t('chatHeader.actions.assignTag')}
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={e => { e.stopPropagation(); onDeleteConversation(conversation); }}
            className="flex items-center gap-2"
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" />
            {t('chatHeader.actions.deleteConversation')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div
      data-tour="chat-sidebar"
      className={`
        ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex
        w-full md:w-80 border-r bg-card/50 flex-col h-full
      `}
    >
      {/* Search and Filter Header */}
      <div className="p-4 border-b space-y-3">
        <div className="relative" data-tour="chat-search">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder={t('chatSidebar.searchPlaceholder')}
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            className="pl-10"
          />
          <GlobalSearchPanel
            isOpen={isSearchPanelOpen && searchInput.trim().length > 0}
            searchTerm={debouncedSearchTerm}
            rawInputValue={searchInput}
            onClose={() => setIsSearchPanelOpen(false)}
            onSelectConversation={handleSelectConversation}
            onSelectContact={handleSelectContact}
            onSelectMessage={handleSelectMessage}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showArchived ? 'ghost' : 'secondary'}
            size="sm"
            className="h-8 cursor-pointer"
            aria-pressed={!showArchived}
            onClick={() => setShowArchived(false)}
          >
            {t('chatSidebar.view.active')}
          </Button>
          <Button
            type="button"
            variant={showArchived ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 cursor-pointer"
            aria-pressed={showArchived}
            onClick={() => setShowArchived(true)}
          >
            {t('chatSidebar.view.archived')}
          </Button>
        </div>

        {/* Seletor rápido de instância (WhatsApp) — filtra a lista por instância */}
        {inboxOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">Instância</span>
            <select
              value={selectedInboxId}
              onChange={(e) => applyInstanceFilter(e.target.value)}
              className="h-8 flex-1 cursor-pointer rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
              aria-label="Filtrar por instância"
            >
              <option value="">Todas as instâncias</option>
              {inboxOptions.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {pagination?.total != null && pagination.total > visibleConversations.length
              ? `${visibleConversations.length} / ${pagination.total}`
              : visibleConversations.length}{' '}
            {(pagination?.total ?? visibleConversations.length) === 1
              ? t('chatSidebar.conversation')
              : t('chatSidebar.conversations')}
          </span>
          <div className="flex items-center gap-2">
            {filters.state.activeFilters.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.state.activeFilters.length}{' '}
                {filters.state.activeFilters.length === 1
                  ? t('chatSidebar.filter')
                  : t('chatSidebar.filters')}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterModalOpen(true)}
              disabled={filters.state.isApplyingFilters}
              className="h-8 px-2 cursor-pointer"
              data-tour="chat-filter-button"
            >
              <Filter className="h-4 w-4" />
              {t('chatSidebar.filtersButton')}
            </Button>
          </div>
        </div>
        {showArchived && (
          <p className="text-xs text-muted-foreground">{t('chatSidebar.archivedNotice')}</p>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedConversations.size > 0 && (
        <div className="px-3 py-2 border-b bg-primary/5 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedConversations.size} selecionada{selectedConversations.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkResolve} className="h-7 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolver todas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedConversations(new Set())} className="h-7 text-xs">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div
        ref={sidebarScrollRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={handleSidebarScroll}
        data-tour="chat-conversations-list"
      >
        {!conversations ? (
          <ConversationSkeleton count={8} />
        ) : conversations.state.conversationsLoading || filters.state.isApplyingFilters ? (
          <ConversationSkeleton count={8} />
        ) : conversations.state.conversationsError ? (
          <div className="p-4 text-center">
            <div className="text-destructive mb-2">{t('chatSidebar.errors.loadConversations')}</div>
            <p className="text-sm text-muted-foreground mb-4">
              {conversations.state.conversationsError}
            </p>
            <Button variant="outline" size="sm" onClick={() => conversations.loadConversations({})}>
              {t('chatSidebar.errors.tryAgain')}
            </Button>
          </div>
        ) : visibleConversations.length === 0 ? (
          <div className="p-4 text-center">
            {searchInput ? (
              <NoConversations
                searchTerm={searchInput}
                onCreateNew={() => console.log('Create new conversation')}
              />
            ) : (
              <div className="py-8">
                <div className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {showArchived ? t('chatSidebar.emptyArchived.title') : t('chatSidebar.empty.title')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {showArchived ? t('chatSidebar.emptyArchived.description') : t('chatSidebar.empty.description')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {visibleConversations.map((conversation: Conversation) => {
              const isSelected =
                String(conversations.state.selectedConversationId) === String(conversation.id);

              const channelType =
                conversation.inbox?.channel_type || conversation.inbox?.channel_type;
              const channelProvider = conversation.inbox?.provider;
              const urgencyColor = getUrgencyColor(conversation.timestamp);

              return renderConversationContextMenu(
                conversation,
                <div
                  key={conversation.id}
                  className={`relative hover:bg-accent cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10' : 'border-b border-border/50'
                  }`}
                  onClick={() => onConversationSelect(conversation)}
                >
                  {/* Urgency strip — 3px left edge */}
                  {!isSelected && conversation.status === 'open' && (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: urgencyColor,
                        borderRadius: '0 2px 2px 0',
                        opacity: 0.85,
                      }}
                    />
                  )}
                  {/* Selected indicator */}
                  {isSelected && (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: 'var(--primary)',
                        borderRadius: '0 2px 2px 0',
                      }}
                    />
                  )}

                  <div className="p-4 pl-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedConversations.has(String(conversation.id))}
                          onChange={e => {
                            e.stopPropagation();
                            setSelectedConversations(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(String(conversation.id));
                              else next.delete(String(conversation.id));
                              return next;
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                          className="mt-1 flex-shrink-0 cursor-pointer"
                        />
                        <ContactAvatar
                          contact={conversation.contact}
                          channelType={channelType}
                          channelProvider={channelProvider}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {conversation.contact?.name || t('chatSidebar.contactNoName')}
                                </p>
                                {conversation.contact?.phone_number && (
                                  <p className="text-xs text-muted-foreground/70 truncate">
                                    {conversation.contact.phone_number}
                                  </p>
                                )}
                              </div>
                              {Boolean(conversation.custom_attributes?.pinned) && (
                                <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              )}
                              {conversation.additional_attributes?.conversation_type === 'post' && (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1.5 text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700 flex-shrink-0"
                                  title="Facebook Post"
                                >
                                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                                  Post
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span
                                className="text-xs text-muted-foreground"
                                title={formatDetailedTime(conversation.timestamp)}
                              >
                                {formatConversationTime(conversation.timestamp)}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground truncate">
                            {getLastMessage(conversation)}
                          </p>

                          <ConversationBadges conversation={conversation} maxLabels={2} />

                          {conversation?.assignee && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 dark:bg-primary/20">
                                <UserIcon className="h-3 w-3 flex-shrink-0 text-primary dark:text-primary" />
                                <span
                                  className="truncate max-w-32 text-primary dark:text-primary/90"
                                  title={conversation.assignee?.name}
                                >
                                  {conversation.assignee?.name}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {(() => {
                          const hasUnreadMessages =
                            (conversations.getUnreadCount(conversation.id) || 0) > 0;
                          return hasUnreadMessages ? (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>,
              );
            })}

            {isLoadingMoreConversations && (
              <div className="border-t border-border/40">
                <ConversationSkeleton count={1} />
              </div>
            )}

            {!isLoadingMoreConversations && hasNextPage && (
              <div className="p-3 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleLoadMoreClick}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConversationsFilter
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        filters={conversationFilters}
        onFiltersChange={setConversationFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
};

export default ChatSidebar;
