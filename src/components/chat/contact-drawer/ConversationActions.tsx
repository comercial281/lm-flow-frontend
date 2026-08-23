import React, { useState, useEffect } from 'react';

import { Button } from '@evoapi/design-system/button';
import { Badge } from '@evoapi/design-system/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@evoapi/design-system/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system/select';
import { Settings, UserPlus, UserMinus, Tag, Zap, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Conversation } from '@/types/chat/api';
import { useConversations } from '@/hooks/chat/useConversations';
import { useLanguage } from '@/hooks/useLanguage';
import type { Label } from '@/types/settings';
import { chatService } from '@/services/chat/chatService';
import usersService from '@/services/users/usersService';
import type { User } from '@/types/users';
import { useFeature } from '@/contexts/TenantFeaturesContext';

interface ConversationActionsProps {
  conversation: Conversation | null;
  onFilterReload?: () => Promise<void>;
}

const ConversationActions: React.FC<ConversationActionsProps> = ({
  conversation,
  onFilterReload,
}) => {
  const { t } = useLanguage('chat');
  const canAssign = useFeature('chat_assign');
  const canLabels = useFeature('chat_labels');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [agents, setAgents] = useState<User[]>([]);

  const conversations = useConversations();

  useEffect(() => {
    if (!conversation?.inbox_id) return;
    usersService.getAssignableAgents(String(conversation.inbox_id))
      .then((res: User[] | { data: User[] }) => setAgents(Array.isArray(res) ? res : (res as { data: User[] }).data ?? []))
      .catch(() => {});
  }, [conversation?.inbox_id]);

  const handleStatusChange = async (newStatus: 'open' | 'resolved' | 'pending' | 'snoozed') => {
    if (!conversation) return;

    setIsUpdatingStatus(true);
    try {
      await conversations.updateConversationStatus(conversation.id, newStatus, onFilterReload);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: 'low' | 'medium' | 'high' | 'urgent' | null) => {
    if (!conversation) return;

    setIsUpdatingPriority(true);
    try {
      await conversations.updateConversationPriority(conversation.id, newPriority, onFilterReload);
    } catch (error) {
      console.error('Error updating priority:', error);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleAssigneeChange = async (agentId: string | null) => {
    if (!conversation) return;

    setIsAssigning(true);
    try {
      await chatService.assignConversation(String(conversation.id), agentId ?? undefined);
      if (agentId) {
        toast.success(t('contactSidebar.conversationActions.assignment.assignedSuccess'));
      } else {
        toast.success(t('contactSidebar.conversationActions.assignment.unassignedSuccess'));
      }
      onFilterReload?.();
    } catch (error) {
      console.error('Error assigning agent:', error);
      toast.error(t('contactSidebar.conversationActions.assignment.error'));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Status Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('contactSidebar.conversationActions.status.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <StatusButton
              status="open"
              current={conversation?.status}
              onClick={() => handleStatusChange('open')}
              disabled={isUpdatingStatus}
            />
            <StatusButton
              status="resolved"
              current={conversation?.status}
              onClick={() => handleStatusChange('resolved')}
              disabled={isUpdatingStatus}
            />
            <StatusButton
              status="pending"
              current={conversation?.status}
              onClick={() => handleStatusChange('pending')}
              disabled={isUpdatingStatus}
            />
            <StatusButton
              status="snoozed"
              current={conversation?.status}
              onClick={() => handleStatusChange('snoozed')}
              disabled={isUpdatingStatus}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assignment Actions */}
      {canAssign && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('contactSidebar.conversationActions.assignment.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={conversation?.assignee_id ? String(conversation.assignee_id) : '__none__'}
              onValueChange={(val) => handleAssigneeChange(val === '__none__' ? null : val)}
              disabled={isAssigning}
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder={t('contactSidebar.conversationActions.assignment.notAssigned')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t('contactSidebar.conversationActions.assignment.notAssigned')}
                </SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {conversation?.assignee_id && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAssigneeChange(null)}
                disabled={isAssigning}
              >
                <UserMinus className="h-4 w-4 mr-2" />
                {t('contactSidebar.conversationActions.assignment.unassign')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Labels Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {t('contactSidebar.conversationActions.labels.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversation?.labels && conversation.labels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {conversation.labels.map((label: Label) => (
                <Badge key={label.id} variant="secondary" className="text-xs">
                  {label.title}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
              {t('contactSidebar.conversationActions.labels.noneApplied')}
            </div>
          )}

          {canLabels && (
            <Button variant="outline" className="w-full justify-start">
              <Tag className="h-4 w-4 mr-2" />
              {t('contactSidebar.conversationActions.labels.manage')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Prioridade da Conversa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('contactSidebar.conversationActions.priority.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <PriorityButton
              priority="low"
              current={conversation?.priority}
              onClick={() => handlePriorityChange('low')}
              disabled={isUpdatingPriority}
            />
            <PriorityButton
              priority="medium"
              current={conversation?.priority}
              onClick={() => handlePriorityChange('medium')}
              disabled={isUpdatingPriority}
            />
            <PriorityButton
              priority="high"
              current={conversation?.priority}
              onClick={() => handlePriorityChange('high')}
              disabled={isUpdatingPriority}
            />
            <PriorityButton
              priority="urgent"
              current={conversation?.priority}
              onClick={() => handlePriorityChange('urgent')}
              disabled={isUpdatingPriority}
            />
          </div>

          {conversation?.priority && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePriorityChange(null)}
              disabled={isUpdatingPriority}
              className="w-full justify-start text-xs"
            >
              {t('contactSidebar.conversationActions.priority.remove')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Status Button Component
interface StatusButtonProps {
  status: string;
  current?: string;
  onClick: () => void;
  disabled: boolean;
}

const StatusButton: React.FC<StatusButtonProps> = ({ status, current, onClick, disabled }) => {
  const { t } = useLanguage('chat');
  const isCurrent = status === current;

  const getStatusConfig = (status: string) => {
    const configs = {
      open: {
        label: t('contactSidebar.conversationActions.status.open'),
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      },
      resolved: {
        label: t('contactSidebar.conversationActions.status.resolved'),
        color: 'text-green-600 bg-green-50 border-green-200',
      },
      pending: {
        label: t('contactSidebar.conversationActions.status.pending'),
        color: 'text-orange-600 bg-orange-50 border-orange-200',
      },
      snoozed: {
        label: t('contactSidebar.conversationActions.status.snoozed'),
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      },
    };

    return (
      configs[status as keyof typeof configs] || {
        label: status,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
      }
    );
  };

  const config = getStatusConfig(status);

  return (
    <Button
      variant={isCurrent ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`justify-start relative ${isCurrent ? '' : config.color}`}
    >
      {isCurrent && <Check className="h-3 w-3 mr-2" />}
      {config.label}
    </Button>
  );
};

// Priority Button Component
interface PriorityButtonProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  current?: string | null;
  onClick: () => void;
  disabled: boolean;
}

const PriorityButton: React.FC<PriorityButtonProps> = ({
  priority,
  current,
  onClick,
  disabled,
}) => {
  const { t } = useLanguage('chat');
  const isCurrent = priority === current;

  const getPriorityConfig = (priority: string) => {
    const configs = {
      low: {
        label: t('contactSidebar.conversationActions.priority.low'),
        color: 'text-gray-600 bg-gray-50 border-gray-200',
      },
      medium: {
        label: t('contactSidebar.conversationActions.priority.medium'),
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      },
      high: {
        label: t('contactSidebar.conversationActions.priority.high'),
        color: 'text-orange-600 bg-orange-50 border-orange-200',
      },
      urgent: {
        label: t('contactSidebar.conversationActions.priority.urgent'),
        color: 'text-red-600 bg-red-50 border-red-200',
      },
    };

    return (
      configs[priority as keyof typeof configs] || {
        label: priority,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
      }
    );
  };

  const config = getPriorityConfig(priority);

  return (
    <Button
      variant={isCurrent ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`justify-start relative ${isCurrent ? '' : config.color}`}
    >
      {isCurrent && <Check className="h-3 w-3 mr-2" />}
      {config.label}
    </Button>
  );
};

export default ConversationActions;
