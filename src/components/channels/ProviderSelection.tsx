import React from 'react';
import { BaseHeader, Pagina } from '@/components/base';
import ProviderGrid, { Provider } from './ProviderGrid';
import ChannelBreadcrumb from './ChannelBreadcrumb';
import { useLanguage } from '@/hooks/useLanguage';

interface ProviderSelectionProps {
  channelName: string;
  channelType: 'web_widget' | 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'sms' | 'email' | 'api';
  providers: Provider[];
  isDisabled?: (providerId: string) => boolean;
  disabledTooltip?: (providerId: string) => string | undefined;
  onProviderSelect: (provider: Provider) => void;
  onBack: () => void;
  onChannelListClick?: () => void;
  className?: string;
}

const ProviderSelection: React.FC<ProviderSelectionProps> = ({
  channelName,
  channelType,
  providers,
  isDisabled,
  disabledTooltip,
  onProviderSelect,
  onBack,
  onChannelListClick,
  className = '',
}) => {
  const { t } = useLanguage('channels');

  return (
    <Pagina
      className={className}
      acima={
        <ChannelBreadcrumb
          className="py-0"
          items={[
            { label: t('navigation.channels'), onClick: onChannelListClick || onBack },
            { label: t('navigation.createChannel'), onClick: onBack },
            { label: channelName, active: true },
          ]}
          onBack={onBack}
        />
      }
      cabecalho={
        <BaseHeader
          title={t('newChannel.providerSelection.channelOf', { channelName })}
          subtitle={t('newChannel.providerSelection.connectDescription', { channelName })}
        />
      }
    >
      {/* Provider Selection */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-sidebar-foreground mb-4">
          {t('newChannel.providerSelection.apiProvider')}
        </h2>

        <div data-tour="provider-grid">
          <ProviderGrid
            channelType={channelType}
            providers={providers}
            isDisabled={isDisabled}
            disabledTooltip={disabledTooltip}
            onSelect={onProviderSelect}
          />
        </div>
      </div>
    </Pagina>
  );
};

export default ProviderSelection;
