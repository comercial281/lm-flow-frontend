import { memo, useCallback } from 'react';
import { toast } from 'sonner';
import { formatDateBR } from '@/utils/dateUtils';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Badge,
} from '@/components/ui/ds';
import {
  MoreVertical,
  GripVertical,
  Edit,
  Trash2,
  Copy,
  Phone,
  Mail,
  User,
  CalendarClock,
  ListTodo,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageCircle,
  Archive,
  Home,
} from 'lucide-react';
import { PipelineItem } from '@/types/analytics';
import {
  resolveItemName,
  resolveItemAvatar,
  resolveItemRef,
  getContactColor,
  formatArrivalDate,
  lastContactDays,
  itemVisitLabel,
  hasVisitScheduled,
} from './pipelineItemHelpers';

// Wrapper estável (referência única, nunca recriado) pra parar propagação de
// clique sem gerar uma arrow function nova a cada render.
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

// Fallback de avatar quebrado: não fecha sobre nenhum estado do componente,
// então não precisa de useCallback — a referência já é estável por definição.
const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  (e.currentTarget as HTMLImageElement).style.display = 'none';
  const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
  if (fb) fb.style.display = 'flex';
};

interface PipelineItemCardProps {
  item: PipelineItem;
  stageId: string;
  visitsByContact: Record<string, string>;
  isDraggingRef: React.MutableRefObject<boolean>;
  suppressClickUntilRef: React.MutableRefObject<number>;
  onDragStart: (item: PipelineItem) => void;
  onDragEnd: () => void;
  onCardDragOver: (e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent, item: PipelineItem, stageId: string) => void;
  onOpenItem: (item: PipelineItem) => void;
  onEdit: (item: PipelineItem) => void;
  onArchive: (item: PipelineItem) => void;
  onRemove: (item: PipelineItem) => void;
  onScheduleAction: (item: PipelineItem) => void;
  onNotesClick: (item: PipelineItem) => void;
  // Abre a conversa DENTRO do LM Flow (useOpenLeadConversation, levantado no
  // pai — o modal de "iniciar conversa" só pode montar uma vez pro board
  // inteiro). `opening` é um estado global do hook (não por card): enquanto
  // qualquer card está resolvendo a conversa, o botão WhatsApp de todos fica
  // desabilitado por um instante — mesmo comportamento de antes da extração.
  onOpenConversation: (item: PipelineItem) => void;
  openingConversation: boolean;
}

// Card do Kanban, extraído do JSX inline que antes vivia em PipelineKanban.tsx
// (dentro do .map de stage.items). memo() com comparação SHALLOW padrão (sem
// comparador custom): todas as props de função/ref chegam já estabilizadas
// (useCallback) do pai, então só `item`, `stageId`, `visitsByContact` e
// `openingConversation` variam de verdade — e `item`/`visitsByContact` variam
// por REFERÊNCIA só quando o conteúdo realmente muda (drag/poll/realtime),
// nunca ao digitar na busca ou abrir o menu de OUTRO card.
function PipelineItemCardComponent({
  item,
  stageId,
  visitsByContact,
  isDraggingRef,
  suppressClickUntilRef,
  onDragStart,
  onDragEnd,
  onCardDragOver,
  onCardDrop,
  onOpenItem,
  onEdit,
  onArchive,
  onRemove,
  onScheduleAction,
  onNotesClick,
  onOpenConversation,
  openingConversation,
}: PipelineItemCardProps) {
  const { t } = useLanguage('pipelines');

  const handleCopyId = useCallback(async () => {
    const ref =
      item.contact?.id || item.conversation?.contact?.id || item.item_id || item.id;
    await navigator.clipboard.writeText(String(ref));
    toast.success(t('kanban.idCopied'));
  }, [item, t]);

  const name = resolveItemName(item, t);
  const avatar = resolveItemAvatar(item);
  const daysNoContact = lastContactDays(item);
  const visitLabel = itemVisitLabel(item, visitsByContact);
  const hasVisit = hasVisitScheduled(item);
  const arrivalDate = formatArrivalDate(item);
  // `item.assignee` (topo) já vem do backend com o dono certo — assignee da
  // conversa OU default_assignee do contato. Lead sem conversa aparecia
  // sempre sem responsável. Avatar prioriza a foto real do WhatsApp da
  // instância dele (backend já resolve isso em avatar_url quando ele é dono
  // de uma instância).
  const assignee = item.assignee ?? item.conversation?.assignee;

  return (
    <div
      className="group bg-background rounded-xl p-4 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer select-none relative"
      draggable
      onDragStart={() => onDragStart(item)}
      onDragEnd={onDragEnd}
      onDragOver={onCardDragOver}
      onDrop={e => onCardDrop(e, item, stageId)}
      onClick={() => {
        if (!isDraggingRef.current && Date.now() > suppressClickUntilRef.current) {
          onOpenItem(item);
        }
      }}
    >
      {/* Card Options Menu */}
      <div
        className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        onClick={stopPropagation}
      >
        <div className="flex items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="h-4 w-4 mr-2" />
                {t('kanban.item.editItem')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyId}>
                <Copy className="h-4 w-4 mr-2" />
                {t('kanban.copyId')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onScheduleAction(item)}>
                <CalendarClock className="h-4 w-4 mr-2" />
                {t('kanban.item.scheduleAction')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNotesClick(item)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Ver Notas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(item)}>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onRemove(item)}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('kanban.item.removeFromPipeline')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Contact Info Header */}
      <div className="flex items-start space-x-3 mb-3">
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover shadow-sm bg-muted"
              onError={handleAvatarError}
            />
          ) : null}
          <div
            className="w-10 h-10 rounded-full items-center justify-center text-white text-sm font-bold shadow-sm"
            style={{
              backgroundColor: getContactColor(name),
              display: avatar ? 'none' : 'flex',
            }}
          >
            {name?.[0]?.toUpperCase() || 'U'}
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-background rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="text-sm font-semibold text-foreground truncate">{name}</h4>
            <span
              title={`#${resolveItemRef(item)}`}
              className="shrink-0 text-[10px] text-muted-foreground/60 font-medium"
            >
              #{resolveItemRef(item).slice(0, 6)}
            </span>
          </div>
          {/* Tempo sem contato (medido pela conversa da instância WhatsApp) */}
          {daysNoContact != null && daysNoContact >= 3 && (
            <span
              title={`Última mensagem há ${daysNoContact} dias`}
              className={`inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                daysNoContact >= 7
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              {daysNoContact}d sem contato
            </span>
          )}
          {/* Temperatura do lead (qualificação IA: quente/morno/frio) */}
          {(() => {
            const s = String((item.contact as any)?.qualification_status || '').toLowerCase();
            const map: Record<string, { label: string; cls: string }> = {
              hot: { label: 'Quente', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
              warm: { label: 'Morno', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
              cold: { label: 'Frio', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
            };
            const m = map[s];
            if (!m) return null;
            const score = (item.contact as any)?.qualification_score;
            return (
              <span
                title={`Lead ${m.label}${score ? ` · score ${score}` : ''}`}
                className={`inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${m.cls}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {m.label}
              </span>
            );
          })()}
          {/* Visita agendada — mostra dia/hora se houver visita carregada, senão só a tag */}
          {(visitLabel || hasVisit) && (
            <span
              title="Visita agendada"
              className="inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <CalendarClock className="w-3 h-3" />
              {visitLabel ? `Visita ${visitLabel}` : 'Visita agendada'}
            </span>
          )}
          {/* Imóvel vinculado ao lead */}
          {item.primary_property && (
            <span
              title="Imóvel vinculado"
              className="inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 max-w-[180px]"
            >
              <Home className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {item.primary_property.title || item.primary_property.code || 'Imóvel'}
              </span>
            </span>
          )}
          {/* Contact details */}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {item.contact?.phone_number && (
              <span className="flex items-center space-x-1">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="whitespace-nowrap">{item.contact.phone_number}</span>
              </span>
            )}
            {item.contact?.email && (
              <span className="flex items-center space-x-1">
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-20">{item.contact?.email}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ações rápidas do corretor — responder em <30s sem abrir o lead */}
      {item.contact?.phone_number && (
        <div className="mb-3 flex items-center gap-1.5" onClick={stopPropagation}>
          <a
            href={`tel:${item.contact.phone_number.replace(/[^\d+]/g, '')}`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            title={t('kanban.item.call', 'Ligar')}
          >
            <Phone className="w-3.5 h-3.5" />
            {t('kanban.item.call', 'Ligar')}
          </a>
          {/* Abre a conversa DENTRO do LM Flow. Era um link wa.me,
              que levava o corretor para fora do CRM. */}
          <button
            type="button"
            onClick={() => onOpenConversation(item)}
            disabled={openingConversation}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
            title={t('kanban.item.openChat', 'Abrir conversa')}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t('kanban.item.whatsapp', 'WhatsApp')}
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            title={t('kanban.item.schedule', 'Agendar')}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            {t('kanban.item.schedule', 'Agendar')}
          </button>
        </div>
      )}

      {/* Etiquetas/Tags do contato (ex: tráfego pago) */}
      {Array.isArray((item.contact as any)?.labels) && (item.contact as any).labels.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {(item.contact as any).labels.map((label: any, idx: number) => {
            const color = label?.color || '#7c3aed';
            const labelName = label?.name || label?.title;
            if (!labelName) return null;
            return (
              <span
                key={`${labelName}-${idx}`}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${color}22`, color }}
              >
                {labelName}
              </span>
            );
          })}
        </div>
      )}

      {/* Preview da última mensagem removido do card a pedido
          do Giovani: o card mostra só nome, ID curto, telefone
          e as tags. O histórico fica no modal de detalhes. */}

      {/* Inbox and Status Row */}
      <div className="flex items-center justify-between mb-3">
        {!item.is_lead && (
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1 px-2 py-1 bg-muted/50 rounded-md">
              <div className="w-3 h-3 text-muted-foreground">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-foreground font-medium truncate max-w-16">
                {item.conversation?.inbox?.name || t('kanban.conversation.noInbox')}
              </span>
            </div>
          </div>
        )}
        {!item.is_lead && (
          <div className="flex items-center space-x-2">
            {/* Status badge */}
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                item.conversation?.status === 'open'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : item.conversation?.status === 'resolved'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              }`}
            >
              {item.conversation?.status === 'open'
                ? t('kanban.conversation.status.open')
                : item.conversation?.status === 'resolved'
                ? t('kanban.conversation.status.resolved')
                : item.conversation?.status || t('kanban.conversation.status.unknown')}
            </span>
          </div>
        )}
      </div>

      {/* Services Total Value */}
      {item.services_info?.has_services && item.services_info.total_value > 0 && (
        <div className="mb-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <div className="w-3 h-3">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="font-medium">{t('kanban.conversation.valueLabel')}</span>
            </div>
            <div className="text-xs font-semibold text-green-600 dark:text-green-400">
              {item.services_info.formatted_total}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Summary - Compact and Visual */}
      {(item.tasks_info?.pending_count > 0 ||
        item.tasks_info?.overdue_count > 0 ||
        item.tasks_info?.due_soon_count > 0 ||
        item.tasks_info?.completed_count > 0) && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <div className="text-sm">{t('tasks.title')}</div>
          {/* Tasks vencidas - Prioridade máxima */}
          {item.tasks_info?.overdue_count > 0 && (
            <Badge title={t('tasks.status.overdue')} variant="destructive" className="h-5 px-1.5 text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {item.tasks_info.overdue_count}
            </Badge>
          )}

          {/* Tasks próximas do vencimento */}
          {item.tasks_info?.due_soon_count > 0 && (
            <Badge
              title={t('tasks.status.dueSoon')}
              className="h-5 px-1.5 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
            >
              <Clock className="w-3 h-3 mr-1" />
              {item.tasks_info.due_soon_count}
            </Badge>
          )}

          {/* Tasks pendentes (sem urgência) */}
          {item.tasks_info?.pending_count > 0 &&
            !item.tasks_info?.overdue_count &&
            !item.tasks_info?.due_soon_count && (
              <Badge title={t('tasks.status.pending')} variant="secondary" className="h-5 px-1.5 text-xs">
                <ListTodo className="w-3 h-3 mr-1" />
                {item.tasks_info.pending_count}
              </Badge>
            )}

          {/* Tasks concluídas */}
          {item.tasks_info?.completed_count > 0 && (
            <Badge
              title={t('tasks.status.completed')}
              className="h-5 px-1.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {item.tasks_info.completed_count}
            </Badge>
          )}
        </div>
      )}

      {/* Time and assignee info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1 text-muted-foreground">
          <div className="w-3 h-3">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span title={t('kanban.item.arrivedAt', 'Lead chegou em')}>
            {arrivalDate ||
              (item.conversation?.last_activity_at
                ? formatDateBR(item.conversation.last_activity_at * 1000)
                : '')}
          </span>
        </div>

        {/* Responsável: `item.assignee` (topo) já vem do backend com o dono
            certo — assignee da conversa OU default_assignee do contato. Lead
            sem conversa aparecia sempre sem responsável. Avatar prioriza a
            foto real do WhatsApp da instância dele (backend já resolve isso
            em avatar_url quando ele é dono de uma instância). */}
        {assignee && (
          <div className="flex items-center space-x-1 text-muted-foreground">
            {assignee.avatar_url ? (
              <img
                src={assignee.avatar_url}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
              />
            ) : (
              <User className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate max-w-20">{assignee.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// memo() com comparação SHALLOW padrão — sem comparador custom (o antigo
// componente órfão desta pasta usava JSON.stringify(item), caro e
// desnecessário agora que toda prop de função/ref chega estabilizada do pai).
const PipelineItemCard = memo(PipelineItemCardComponent);
PipelineItemCard.displayName = 'PipelineItemCard';

export default PipelineItemCard;
