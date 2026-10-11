import { MessageCircle } from 'lucide-react';
import type { DashboardApp } from '@/types/integrations';
import { useLanguage } from '@/hooks/useLanguage';
import Abas from '@/components/base/Abas';

interface ChatTabsProps {
  dashboardApps: DashboardApp[];
  activeTab: string; // 'chat' or app.id
  onTabChange: (tabId: string) => void;
  conversationSelected: boolean;
}

const ChatTabs = ({ dashboardApps, activeTab, onTabChange, conversationSelected }: ChatTabsProps) => {
  const { t } = useLanguage('chat');

  if (!conversationSelected) {
    return null;
  }

  // Filter for conversation type apps only
  const conversationApps = dashboardApps.filter(app => app.display_type === 'conversation');

  // If no conversation apps, don't show tabs
  if (conversationApps.length === 0) {
    return null;
  }

  return (
    <Abas
      rotulo="Partes da conversa"
      className="bg-background px-4"
      ativa={activeTab}
      aoTrocar={onTabChange}
      abas={[
        { chave: 'chat', rotulo: t('chatTabs.chat'), icone: MessageCircle },
        ...conversationApps.map(app => ({ chave: app.id, rotulo: app.title })),
      ]}
    />
  );
};

export default ChatTabs;
