import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/ds';
import { Agent } from '@/types/agents';
import { AgentChatProvider } from '@/contexts/agents/AgentChatContext';
import { AgentChatSessionList, AgentChatArea } from '@/pages/Customer/Agents/Agent/chat';
import { useLanguage } from '@/hooks/useLanguage';

interface AgentTestChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
}

export default function AgentTestChat({ open, onOpenChange, agent }: AgentTestChatProps) {
  const { t } = useLanguage('aiAgents');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="sm:max-w-6xl h-[90dvh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('chat.chatWithAgent', { name: agent.name })}</DialogTitle>
          <DialogDescription>{t('chat.startConversation')}</DialogDescription>
        </DialogHeader>
        <AgentChatProvider agentId={agent.id} key={open ? 'open' : 'closed'}>
          <div className="flex h-full overflow-hidden">
            <AgentChatSessionList />
            <AgentChatArea agent={agent} />
          </div>
        </AgentChatProvider>
      </DialogContent>
    </Dialog>
  );
}
