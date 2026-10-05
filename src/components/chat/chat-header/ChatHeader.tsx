import { Suspense, useEffect, useState } from 'react';
import { Button } from '@evoapi/design-system/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@evoapi/design-system/tooltip';
import {
  ArrowLeft,
  X,
  MessageCircle,
  CheckCircle,
  Clock,
  Bot,
  BotOff,
  UserCheck,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  User as UserIcon,
  Users,
  UserMinus,
  Trash2,
  CalendarClock,
  Mail,
  MailOpen,
  Unlock,
  Pin,
  Archive,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@evoapi/design-system/dropdown-menu';
import { toast } from 'sonner';
import { Conversation } from '@/types/chat/api';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import ActivateAiDialog from '@/components/chat/conversation/ActivateAiDialog';
import { isPendingStatus } from '@/utils/chat/conversationStatus';
import { linhaDoTopo } from '@/features/conversas/topoDaConversa';
import { nomeNaTela } from '@/features/conversas/painelDoLead';
import { useNumerosDaConversa } from '@/features/numbers/useNumerosDaConversa';
import { useLanguage } from '@/hooks/useLanguage';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { chatService } from '@/services/chat/chatService';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { lazyWithRetry } from '@/utils/chunkReload';
import { avisarAgendadosMudaram } from '@/features/conversas/agendados';

// A mesma janela de agendamento do card do lead, carregada só quando abre.
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);

interface ChatHeaderProps {
  conversation: Conversation;
  onBackClick: () => void;
  onCloseConversation: () => void;
  onContactSidebarOpen: () => void;
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
  onUnassignAgent: (conversation: Conversation) => void;
  onUnassignTeam: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  unreadCount: number;
  /** Oferta da roleta aberta para quem vê: nome que é o telefone sai mascarado. */
  emOferta?: boolean;
}

const ChatHeader = ({
  conversation,
  onBackClick,
  onCloseConversation,
  onContactSidebarOpen,
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
  onUnassignAgent,
  onUnassignTeam,
  onDeleteConversation,
  unreadCount,
  emOferta = false,
}: ChatHeaderProps) => {
  const { t } = useLanguage('chat');
  // O menu é controlado por causa da janela da IA: o item precisa FECHAR o menu
  // e só então abrir a janela. Menu e janela disputando o foco no mesmo instante
  // é o jeito clássico de a janela abrir e fechar sozinha.
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const canScheduleAction = useFeature('card_schedule_action');
  // Liga/desliga a IA NESTA conversa (pedido do Giovani, 19/08). Usa o mesmo
  // endpoint que o card do Kanban já lê pra pintar o robozinho — POST
  // /conversations/:id/sales_agent — em vez de escrever additional_attributes
  // na mão: esse endpoint também limpa sales_agent_handoff ao religar, senão
  // uma conversa que a IA passou pra um corretor ficaria travada mentindo que
  // ainda está em transferência (ver SalesAgents::ConversationState).
  const [aiState, setAiState] = useState<SalesAgentCardState | null>(null);
  const [togglingAi, setTogglingAi] = useState(false);
  useEffect(() => {
    let alive = true;
    chatService
      .getSalesAgentStatus(conversation.id)
      .then(r => { if (alive) setAiState(r.state); })
      .catch(() => { if (alive) setAiState(null); });
    return () => { alive = false; };
  }, [conversation.id]);

  const aiEnabled = aiState?.status === 'active' || aiState?.status === 'idle';

  const handleToggleAi = async () => {
    const next = !aiEnabled;
    setTogglingAi(true);
    try {
      const state = await chatService.toggleSalesAgent(conversation.id, next);
      setAiState(state);
      toast.success(next ? 'IA reativada nesta conversa' : 'IA desativada nesta conversa');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mudar o status da IA'));
    } finally {
      setTogglingAi(false);
    }
  };

  const currentStatus = conversation.status;
  const hasUnreadMessages = unreadCount > 0;
  const isPinned = Boolean(conversation.custom_attributes?.pinned);
  const isArchived = Boolean(conversation.custom_attributes?.archived);

  const { inboxes } = useNumerosDaConversa();

  // Quem é o lead pra agendar: o contato da conversa (ou o remetente, quando a
  // conversa veio sem o contato embutido).
  const contatoId = conversation.contact?.id ?? conversation.meta?.sender?.id ?? null;
  // Mesma chave do "Agendar envio" do card do lead: desligou lá, some aqui.
  // Na oferta da roleta não aparece: a janela mostra o telefone do lead.
  const podeAgendar = canScheduleAction && contatoId != null && !emOferta;

  const prioridades = [
    { valor: 'urgent' as const, rotulo: 'Urgente', Icone: AlertTriangle, cor: 'text-red-600' },
    { valor: 'high' as const, rotulo: 'Alta', Icone: ArrowUp, cor: 'text-orange-600' },
    { valor: 'medium' as const, rotulo: 'Média', Icone: Minus, cor: 'text-blue-600' },
    { valor: 'low' as const, rotulo: 'Baixa', Icone: ArrowDown, cor: 'text-gray-600' },
  ];

  // Menu enxuto (pedido do Tony, 04/10/2026): de 17 itens soltos para 9 linhas,
  // com Status, Prioridade e Atribuir em submenu. "Atribuir etiqueta" saiu: a
  // seção Etiquetas do painel do lead já faz isso. As regras de cada item
  // (quando aparece, o que chama) são as mesmas de antes; as travas de
  // permissão moram nos handlers da página de Conversas.
  const renderConversationStatusDropdown = () => {
    return (
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Mais ações" title="Mais ações">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {/* Agendar mensagem: a MESMA janela do "Agendar envio" do card do lead.
              Fecha o menu antes de abrir a janela (mesma razão da IA, abaixo). */}
          {podeAgendar && (
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                setAgendando(true);
              }}
              className="flex items-center gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              Agendar mensagem
            </DropdownMenuItem>
          )}

          {/* IA Vendedora.
              É a ação que resgata o lead que ficou no vácuo (ex.: escreveu fora
              do horário de atuação e não teve resposta): a IA lê a conversa
              inteira e continua de onde parou, sem se reapresentar. Ela existia
              só na API e numa janela que nenhuma tela abria. */}
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setAiOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Bot className="h-4 w-4" />
            Ativar IA pra este lead
          </DropdownMenuItem>

          {/* Lida / não lida */}
          {hasUnreadMessages ? (
            <DropdownMenuItem
              onClick={() => onMarkAsRead(conversation)}
              className="flex items-center gap-2"
            >
              <MailOpen className="h-4 w-4" />
              {t('chatHeader.actions.markAsRead')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onMarkAsUnread(conversation)}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              {t('chatHeader.actions.markAsUnread')}
            </DropdownMenuItem>
          )}

          {/* Resolver; resolvida, o mesmo lugar reabre. */}
          {currentStatus === 'resolved' ? (
            <DropdownMenuItem
              onClick={() => onMarkAsOpen(conversation)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Reabrir conversa
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onMarkAsResolved(conversation)}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {t('chatHeader.actions.markAsResolved')}
            </DropdownMenuItem>
          )}

          {/* Status ▸ Pendente · Pausar conversa. Pendente ou pausada, o
              submenu também reabre (antes era o "Marcar como aberta" solto). */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuCheckboxItem
                  checked={currentStatus === 'pending'}
                  disabled={currentStatus === 'pending'}
                  onSelect={() => onPostpone(conversation)}
                >
                  Pendente
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={currentStatus === 'snoozed'}
                  disabled={currentStatus === 'snoozed'}
                  onSelect={() => onMarkAsSnoozed(conversation)}
                >
                  {t('chatHeader.actions.pauseConversation')}
                </DropdownMenuCheckboxItem>
                {(currentStatus === 'pending' || currentStatus === 'snoozed') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onMarkAsOpen(conversation)}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Reabrir conversa
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Prioridade ▸ Urgente · Alta · Média · Baixa, com o ✓ na atual. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Prioridade
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48">
                {prioridades.map(({ valor, rotulo, Icone, cor }) => (
                  <DropdownMenuCheckboxItem
                    key={valor}
                    checked={conversation.priority === valor}
                    onSelect={() => onSetPriority(conversation, valor)}
                    className="gap-2"
                  >
                    <Icone className={`h-4 w-4 ${cor}`} />
                    {rotulo}
                  </DropdownMenuCheckboxItem>
                ))}
                {conversation.priority && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onSetPriority(conversation, null)}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t('chatHeader.actions.removePriority')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            onClick={() =>
              isPinned ? onUnpinConversation(conversation) : onPinConversation(conversation)
            }
            className="flex items-center gap-2"
          >
            <Pin className="h-4 w-4" />
            {isPinned
              ? t('chatHeader.actions.unpinConversation')
              : t('chatHeader.actions.pinConversation')}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              isArchived
                ? onUnarchiveConversation(conversation)
                : onArchiveConversation(conversation)
            }
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            {isArchived
              ? t('chatHeader.actions.unarchiveConversation')
              : t('chatHeader.actions.archiveConversation')}
          </DropdownMenuItem>

          {/* Atribuir ▸ Atendente · Time · Desvincular (só com vínculo). */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Atribuir
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem
                  onClick={() => onAssignAgent(conversation)}
                  className="flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  Atendente
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAssignTeam(conversation)}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Time
                </DropdownMenuItem>
                {conversation.assignee_id && (
                  <DropdownMenuItem
                    onClick={() => onUnassignAgent(conversation)}
                    className="flex items-center gap-2"
                  >
                    <UserMinus className="h-4 w-4" />
                    {t('chatHeader.actions.unassignAgent')}
                  </DropdownMenuItem>
                )}
                {conversation.team_id && (
                  <DropdownMenuItem
                    onClick={() => onUnassignTeam(conversation)}
                    className="flex items-center gap-2"
                  >
                    <UserMinus className="h-4 w-4" />
                    {t('chatHeader.actions.unassignTeam')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onDeleteConversation(conversation)}
            className="flex items-center gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {t('chatHeader.actions.deleteConversation')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="wa-header flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Back button for mobile */}
          <Button variant="ghost" size="sm" className="md:hidden" onClick={onBackClick} aria-label="Voltar" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all rounded-full"
            onClick={onContactSidebarOpen}
          >
            <ContactAvatar contact={conversation.contact} />
          </div>
          <div
            className="cursor-pointer rounded-md px-1 -mx-1 hover:bg-muted/60 transition-colors"
            onClick={onContactSidebarOpen}
            title={t('chatHeader.openContactInfo', 'Ver dados do contato')}
          >
            <h3 className="lm-redact font-semibold">
              {nomeNaTela(conversation.contact?.name, emOferta) || t('chatHeader.contactNoName')}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {linhaDoTopo({
                  inboxId: conversation.inbox?.id,
                  inboxNome: conversation.inbox?.name,
                  inboxes,
                  responsavel: conversation.assignee?.name,
                })}
              </span>
            </div>
          </div>
        </div>
        {/* Ações do chat */}
        <div className="flex items-center gap-2">
          {/* Botão abrir conversa pendente */}
          {isPendingStatus(conversation.status) && (
            <Button
              variant="plain"
              size="sm"
              onClick={() => onMarkAsOpen(conversation)}
              className="flex items-center gap-2 text-primary hover:text-primary/80 hover:bg-primary/10 transition-all duration-200"
            >
              <Unlock className="h-4 w-4" />
              {t('chatHeader.openConversation')}
            </Button>
          )}

          {/* Ativar/desligar IA nesta conversa — só aparece quando existe
              alguma IA Vendedora configurada neste canal (status !== 'none'),
              senão o botão liga/desliga algo que não existe. */}
          {aiState && aiState.status !== 'none' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={togglingAi}
                    onClick={handleToggleAi}
                    aria-label={
                      aiState.status === 'handoff'
                        ? 'Religar IA Vendedora'
                        : aiEnabled
                          ? 'Desligar IA Vendedora'
                          : 'Ligar IA Vendedora'
                    }
                    title={
                      aiState.status === 'handoff'
                        ? 'Religar IA Vendedora'
                        : aiEnabled
                          ? 'Desligar IA Vendedora'
                          : 'Ligar IA Vendedora'
                    }
                    className={`h-8 w-8 p-0 ${
                      aiState.status === 'active'
                        ? 'text-violet-600 hover:text-violet-700 dark:text-violet-400'
                        : aiState.status === 'handoff'
                          ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
                          : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {aiState.status === 'handoff' ? (
                      <UserCheck className="h-4 w-4" />
                    ) : aiEnabled ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <BotOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {aiState.status === 'handoff'
                      ? 'A IA passou este lead pra um corretor — clique para religar'
                      : aiEnabled
                        ? `${aiState.label} — clique para desativar`
                        : `${aiState.label} — clique para reativar`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Dropdown de ações da conversa */}
          {renderConversationStatusDropdown()}

          {/* Botão fechar conversa */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCloseConversation}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t('chatHeader.closeConversation')}</span>
          </Button>
        </div>
      </div>

      {/* Fora do menu de propósito: montada aqui, ela sobrevive ao menu fechar. */}
      <ActivateAiDialog conversation={conversation} open={aiOpen} onOpenChange={setAiOpen} />

      {agendando && contatoId != null && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open
            contactId={String(contatoId)}
            onClose={() => {
              setAgendando(false);
              avisarAgendadosMudaram(contatoId);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ChatHeader;
