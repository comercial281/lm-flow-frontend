
import { Settings, Trash2 } from 'lucide-react';
import { BaseTable, TableColumn, TableAction } from '@/components/base';
import { Inbox } from '@/types/channels/inbox';
import { ChannelConnectionBadge, ChannelIcon } from '@/components/channels';
import { getChannelDisplayName } from '@/utils/channelUtils';
import { useLanguage } from '@/hooks/useLanguage';

export default function ChannelsTable({
  channels,
  loading,
  onSettings,
  onDelete,
}: {
  channels: Inbox[];
  loading?: boolean;
  onSettings?: (inbox: Inbox) => void;
  onDelete: (inbox: Inbox) => void;
}) {
  const { t } = useLanguage('channels');

  const columns: TableColumn<Inbox>[] = [
    {
      key: 'name',
      label: t('table.channels'),
      render: (item: Inbox) => (
        <div className="flex items-center gap-3">
          {item.avatar_url ? (
            <img
              src={item.avatar_url}
              alt={item.provider_config?.whatsapp_profile_name || item.name}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <ChannelIcon channelType={item.channel_type} provider={item.provider as string | undefined} size="md" />
          )}
          <div className="flex flex-col">
            <span className="font-medium text-sidebar-foreground">{item.name}</span>
            <span className="text-xs text-sidebar-foreground/60">{item.channel_type ? getChannelDisplayName(item.channel_type, item.provider) : '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'connection_status',
      label: t('table.connection'),
      render: (item: Inbox) =>
        item.connection_status ? (
          <ChannelConnectionBadge
            status={item.connection_status}
            variant="compact"
            className="items-start"
          />
        ) : (
          <span className="text-sidebar-foreground/40">—</span>
        ),
    },
    {
      key: 'display_name',
      label: t('table.displayName'),
      render: (item: Inbox) => (
        <span className="text-sidebar-foreground">{item.display_name || '—'}</span>
      ),
    },
    {
      key: 'whatsapp_profile_name',
      label: t('table.whatsappName'),
      render: (item: Inbox) => (
        <span className="text-sidebar-foreground">{item.provider_config?.whatsapp_profile_name || '—'}</span>
      ),
    },
    { key: 'id', label: t('table.id') },
  ];

  const actions: TableAction<Inbox>[] = [
    ...(onSettings ? [{ label: t('actions.configure'), onClick: onSettings, icon: <Settings className="h-4 w-4" /> }] : []),
    { label: t('actions.delete'), onClick: onDelete, icon: <Trash2 className="h-4 w-4" />, variant: 'destructive' },
  ] as TableAction<Inbox>[];

  return (
    <BaseTable
      data={channels}
      columns={columns}
      actions={actions}
      loading={loading}
      emptyTitle={t('table.empty.title')}
      emptyDescription={t('table.empty.description')}
      getRowKey={i => i.id}
    />
  );
}


