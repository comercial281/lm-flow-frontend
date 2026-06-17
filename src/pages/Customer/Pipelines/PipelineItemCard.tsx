import React, { memo, useMemo } from 'react';
import { PipelineItem } from '@/types/pipelines';
import { useLanguage } from '@/hooks/useLanguage';
import { MoreVertical, Copy, Edit, Trash2, MessageCircle, CalendarClock, Phone, Mail, MessageSquare, Clock } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@aevoapi/design-system';
import { toast } from 'sonner';

interface PipelineItemCardProps {
  item: PipelineItem;
  onDragStart: (item: PipelineItem) => void;
  onDragEnd: () => void;
  onClick: (item: PipelineItem) => void;
  onEdit: (item: PipelineItem) => void;
  onDelete: (item: PipelineItem) => void;
  onScheduleAction: (item: PipelineItem) => void;
  onNotesClick: (contact: { id: string; name?: string }) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
  suppressClickUntilRef: React.MutableRefObject<number>;
  resolveItemName: (item: PipelineItem) => string;
  resolveItemAvatar: (item: PipelineItem) => string | undefined;
  getContactColor: (name?: string) => string;
  formatArrivalDate: (item: PipelineItem) => string | null;
  lastContactDays: (item: PipelineItem) => number | null;
  itemVisitLabel: (item: PipelineItem) => string | null;
  hasVisitScheduled: (item: PipelineItem) => boolean;
}

const PipelineItemCardComponent = memo(({
  item,
  onDragStart,
  onDragEnd,
  onClick,
  onEdit,
  onDelete,
  onScheduleAction,
  onNotesClick,
  isDraggingRef,
  suppressClickUntilRef,
  resolveItemName,
  resolveItemAvatar,
  getContactColor,
  formatArrivalDate,
  lastContactDays,
  itemVisitLabel,
  hasVisitScheduled,
}: PipelineItemCardProps) => {
  const { t } = useLanguage();

  // Memoize computed values para evitar re-calcular a cada render
  const contactColor = useMemo(() => getContactColor(resolveItemName(item)), [item, getContactColor, resolveItemName]);
  const avatar = useMemo(() => resolveItemAvatar(item), [item, resolveItemAvatar]);
  const name = useMemo(() => resolveItemName(item), [item, resolveItemName]);
  const arrivalDate = useMemo(() => formatArrivalDate(item), [item, formatArrivalDate]);
  const daysNoContact = useMemo(() => lastContactDays(item), [item, lastContactDays]);
  const visitLabel = useMemo(() => itemVisitLabel(item), [item, itemVisitLabel]);
  const hasVisit = useMemo(() => hasVisitScheduled(item), [item, hasVisitScheduled]);

  return (
    <div
      key={item.id}
      className="group bg-background rounded-xl p-4 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer select-none relative"
      draggable
      onDragStart={() => {
        onDragStart(item);
        isDraggingRef.current = true;
      }}
      onDragEnd={() => {
        onDragEnd();
        isDraggingRef.current = false;
      }}
      onClick={() => {
        if (!isDraggingRef.current && Date.now() > suppressClickUntilRef.current) {
          onClick(item);
        }
      }}
    >
      {/* Card Options Menu */}
      <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
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
            <DropdownMenuItem onClick={async () => {
              await navigator.clipboard.writeText(String(item.id));
              toast.success(t('kanban.idCopied'));
            }}>
              <Copy className="h-4 w-4 mr-2" />
              {t('kanban.copyId')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onScheduleAction(item)}>
              <CalendarClock className="h-4 w-4 mr-2" />
              {t('kanban.item.scheduleAction')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const contactId = item.contact?.id ?? item.conversation?.contact?.id;
              const contactName = item.contact?.name ?? item.conversation?.contact?.name;
              if (contactId) {
                onNotesClick({ id: contactId, name: contactName });
              }
            }}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Ver Notas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('kanban.item.removeFromPipeline')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contact Info Header */}
      <div className="flex items-start space-x-3 mb-3">
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover shadow-sm bg-muted"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-10 h-10 rounded-full items-center justify-center text-white text-sm font-bold shadow-sm"
            style={{
              backgroundColor: contactColor,
              display: avatar ? 'none' : 'flex',
            }}
          >
            {name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-background rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {name}
            </h4>
            <span className="text-xs text-muted-foreground font-medium">
              #{item.conversation?.display_id}
            </span>
          </div>
          {daysNoContact && daysNoContact >= 3 && (
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
          {(visitLabel || hasVisit) && (
            <span className="inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <CalendarClock className="w-3 h-3" />
              {visitLabel ? `Visita ${visitLabel}` : 'Visita agendada'}
            </span>
          )}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {item.contact?.phone_number && (
              <span className="flex items-center space-x-1">
                <Phone className="w-3 h-3" />
                <span className="truncate max-w-20">
                  {item.contact.phone_number}
                </span>
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

      {/* Last Message Preview */}
      {item.conversation?.last_non_activity_message?.content && (
        <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start space-x-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-foreground">
                  {item.conversation.last_non_activity_message.sender?.name ||
                    t('kanban.conversation.system')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {item.conversation.last_non_activity_message.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Card Footer - Arrival Date */}
      {arrivalDate && (
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Chegou: {arrivalDate}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison — só re-render se o item mudou, não se fns mudaram
  return JSON.stringify(prevProps.item) === JSON.stringify(nextProps.item);
});

PipelineItemCardComponent.displayName = 'PipelineItemCard';

export default PipelineItemCardComponent;
