import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Avatar, AvatarFallback } from '@evoapi/design-system';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ExternalLink } from 'lucide-react';
import { Notification } from '@/services/notifications/NotificationsService';

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onMarkRead?: (notification: Notification) => void;
  getTypeLabel: (type: string) => string;
}

export default function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
  getTypeLabel,
}: NotificationItemProps) {
  const { t } = useLanguage('layout');
  const [isHovered, setIsHovered] = useState(false);
  const isUnread = !notification.read_at;
  const assignee = notification.primary_actor_meta?.assignee;

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return t('notifications.item.someTimeAgo');
    }
  };

  const getAssigneeInitials = (name: string) => {
    if (!name) return t('notifications.item.noAssignee');
    return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      className="w-full relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center p-4 border-b border-border transition-colors cursor-pointer ${
          isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
        }`}
        onClick={() => onOpen(notification)}
      >
        {/* Unread indicator */}
        <div className="flex-shrink-0 w-2">
          {isUnread && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>

        {/* Content */}
        <div className="flex-1 ml-3 overflow-hidden">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {(notification.primary_actor?.id || notification.primary_actor_id) && (
                <span className="font-bold text-foreground text-sm flex-shrink-0">
                  #{notification.primary_actor?.id || notification.primary_actor_id}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-md flex-shrink-0">
                {getTypeLabel(notification.notification_type)}
              </span>
            </div>
            {assignee && (
              <Avatar className="h-4 w-4 flex-shrink-0">
                {assignee.thumbnail ? (
                  <img src={assignee.thumbnail} alt={assignee.name} className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {getAssigneeInitials(assignee.name)}
                  </AvatarFallback>
                )}
              </Avatar>
            )}
          </div>

          <div className="mt-1">
            <span className="text-sm text-foreground line-clamp-2">
              {notification.push_message_title || t('notifications.item.noContent')}
            </span>
          </div>

          <span className="mt-1 text-xs text-muted-foreground">
            {formatTime(notification.last_activity_at)}
          </span>
        </div>
      </div>

      {/* Hover action buttons */}
      {isHovered && isUnread && onMarkRead && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background border border-border rounded-md shadow-sm p-0.5">
          <button
            title="Marcar como lido"
            onClick={e => { e.stopPropagation(); onMarkRead(notification); }}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            title="Abrir conversa"
            onClick={e => { e.stopPropagation(); onOpen(notification); }}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
