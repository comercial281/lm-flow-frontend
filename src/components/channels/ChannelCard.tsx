import { Button, Card, Badge } from '@/components/ui/ds';
import { RefreshCw, Settings, Trash2 } from 'lucide-react';
import { Inbox } from '@/types/channels/inbox';
import ChannelIcon from './ChannelIcon';
import ChannelConnectionBadge from './ChannelConnectionBadge';
import { getChannelDisplayName } from '@/utils/channelUtils';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

type ChannelCardProps = {
  inbox: Inbox;
  isDeleting?: string | null;
  // `tab` abre a tela de configurações já na aba pedida. É o que separa
  // "Reconectar" (vai direto ao QR Code) de "Configurar" (cai nas
  // Configurações básicas, como em qualquer canal no ar).
  onSettings: (inbox: Inbox, tab?: string) => void;
  onDelete: (inbox: Inbox) => void;
  // Excluir canal é do gestor. Quem só ATENDE no número abre a tela para ver o
  // estado e religar — mostrar a lixeira para ele seria um botão vermelho que
  // só sabe recusar.
  canDelete?: boolean;
};

export default function ChannelCard({ inbox, isDeleting, onSettings, onDelete, canDelete = true }: ChannelCardProps) {
  const { t } = useLanguage('channels');
  const typeName = inbox.channel_type
    ? getChannelDisplayName(inbox.channel_type, inbox.provider)
    : '—';
  const whatsappProfileName = inbox.provider_config?.whatsapp_profile_name;
  // Instância caída ganha a borda vermelha além do selo: num grid de doze
  // canais, o selo sozinho some no meio dos outros onze verdes — o card
  // inteiro precisa saltar pra que "qual caiu?" se responda de relance.
  const isDown = inbox.connection_status === 'disconnected';

  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-3 p-5 bg-sidebar border-sidebar-border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/10',
        isDown && 'border-red-500/40 hover:border-red-500/60',
      )}
    >
      {/* Glow no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'rgba(124,58,237,0.16)' }}
      />

      {/* Foto real do perfil (quando já sincronizada) ou ícone genérico do canal,
          com o estado da conexão do lado oposto — a primeira coisa que a pessoa
          precisa saber ao bater o olho no card. */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0 relative bg-sidebar-accent/40 overflow-hidden">
          {inbox.avatar_url ? (
            <img
              src={inbox.avatar_url}
              alt={whatsappProfileName || inbox.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ChannelIcon
              channelType={inbox.channel_type}
              provider={inbox.provider as string | undefined}
              size="lg"
            />
          )}
        </div>

        <ChannelConnectionBadge
          status={inbox.connection_status}
          disconnectedAt={inbox.disconnected_at}
        />
      </div>

      {/* Nome + tipo */}
      <div className="relative min-w-0">
        <h4 className="font-semibold text-base truncate text-sidebar-foreground">{inbox.name}</h4>
        <p className="text-xs text-sidebar-foreground/60 truncate mt-0.5">{inbox.display_name || typeName}</p>
        {whatsappProfileName && (
          <p className="text-xs text-sidebar-foreground/50 truncate mt-0.5">
            {t('card.whatsappName')}: {whatsappProfileName}
          </p>
        )}
      </div>

      {/* Rodapé: badge do tipo + Reconectar/Configurar + excluir */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 mt-auto pt-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-sidebar-border text-sidebar-foreground/70">
          {typeName}
        </Badge>
        <div className="flex items-center gap-1">
          {/* Com a instância caída entra o botão que diz o que a pessoa precisa
              fazer — ele abre direto o QR Code, porque "Configurar" não conta a
              ninguém que dali sai a reconexão. Mas o Configurar CONTINUA ao lado:
              atendentes, horário, nome e o resto funcionam com o número fora do
              ar, e um card que só oferece "Reconectar" faz parecer que não. */}
          {isDown && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => onSettings(inbox, 'configuration')}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('actions.reconnect')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-sidebar border-sidebar-border hover:bg-sidebar-accent"
            onClick={() => onSettings(inbox)}
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            {t('actions.configure')}
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              disabled={isDeleting === inbox.id}
              onClick={() => onDelete(inbox)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
