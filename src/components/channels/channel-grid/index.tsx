import { useMemo, useState, type ReactNode } from 'react';
import { BaseHeader, Pagina } from '@/components/base';
import { Input } from '@/components/ui/ds';
import { Search } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { ChannelCard } from './ChannelCard';
import { ChannelType } from '@/hooks/channels/useChannelForm';

interface ChannelGridProps {
  channels: ChannelType[];
  onChannelSelect: (channel: ChannelType) => void;
  canFB: boolean;
  canIG: boolean;
  /** Trilha "← voltar" acima do título. */
  acima?: ReactNode;
}

export const ChannelGrid = ({ channels, onChannelSelect, canFB, canIG, acima }: ChannelGridProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useLanguage('channels');

  const filteredChannels = useMemo(
    () =>
      channels.filter(
        channel =>
          channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          channel.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery, channels],
  );

  return (
    <Pagina
      acima={acima}
      cabecalho={
        <div data-tour="channel-grid-header">
          <BaseHeader title={t('newChannel.channelGrid.title')} subtitle={t('newChannel.channelGrid.subtitle')} />
        </div>
      }
    >
      {/* Search */}
      <div data-tour="channel-grid-search">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sidebar-foreground/60 h-5 w-5" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('newChannel.channelGrid.searchPlaceholder')}
            className="pl-10 bg-sidebar border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:border-sidebar-border"
          />
        </div>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-8" data-tour="channel-grid-list">
        {filteredChannels.map((channel, index) => {
          // Gate tiles by the backend-sourced `hasXxxConfig` booleans (single
          // source of truth with the admin save endpoint). Twitter has no
          // channel type yet — extend here if/when it lands.
          const disabled =
            channel.type === 'facebook'
              ? !canFB
              : channel.type === 'instagram'
              ? !canIG
              : false;

          return (
            <ChannelCard
              key={channel.id}
              channel={channel}
              disabled={disabled}
              disabledTooltip={disabled ? t('newChannel.channelGrid.notConfiguredTooltip') : undefined}
              onClick={() => onChannelSelect(channel)}
              data-tour={index === 0 ? 'channel-grid-first-card' : undefined}
            />
          );
        })}
      </div>
    </Pagina>
  );
};
