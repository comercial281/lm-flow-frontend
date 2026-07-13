import { Button, Card, Badge } from '@/components/ui/ds';
import { Settings, Trash2 } from 'lucide-react';
import { Inbox } from '@/types/channels/inbox';
import ChannelIcon from './ChannelIcon';
import { getChannelDisplayName } from '@/utils/channelUtils';
import { useLanguage } from '@/hooks/useLanguage';

type ChannelCardProps = {
  inbox: Inbox;
  isDeleting?: string | null;
  onSettings: (inbox: Inbox) => void;
  onDelete: (inbox: Inbox) => void;
};

export default function ChannelCard({ inbox, isDeleting, onSettings, onDelete }: ChannelCardProps) {
  const { t } = useLanguage('channels');
  const typeName = inbox.channel_type
    ? getChannelDisplayName(inbox.channel_type, inbox.provider)
    : '—';

  return (
    <Card className="group relative flex flex-col gap-3 p-5 bg-sidebar border-sidebar-border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/10">
      {/* Glow no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'rgba(124,58,237,0.16)' }}
      />

      {/* Ícone do canal em quadrado (estilo protótipo) */}
      <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0 relative bg-sidebar-accent/40">
        <ChannelIcon
          channelType={inbox.channel_type}
          provider={inbox.provider as string | undefined}
          size="lg"
        />
      </div>

      {/* Nome + tipo */}
      <div className="relative min-w-0">
        <h4 className="font-semibold text-base truncate text-sidebar-foreground">{inbox.name}</h4>
        <p className="text-xs text-sidebar-foreground/60 truncate mt-0.5">{inbox.display_name || typeName}</p>
      </div>

      {/* Rodapé: badge do tipo + Configurar + excluir */}
      <div className="relative flex items-center justify-between gap-2 mt-auto pt-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-sidebar-border text-sidebar-foreground/70">
          {typeName}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-sidebar border-sidebar-border hover:bg-sidebar-accent"
            onClick={() => onSettings(inbox)}
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            {t('actions.configure')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
            disabled={isDeleting === inbox.id}
            onClick={() => onDelete(inbox)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
