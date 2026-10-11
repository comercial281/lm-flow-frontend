import React from 'react';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/ds';

import Aviso from '@/components/base/Aviso';
import { useLanguage } from '@/hooks/useLanguage';

interface ChannelDiagnosticProps {
  inboxId: string;
  onClose: () => void;
}

export const ChannelDiagnostic: React.FC<ChannelDiagnosticProps> = ({
  inboxId,
  onClose,
}) => {
  const { t } = useLanguage('chat');

  return (
    <Aviso
      tom="atencao"
      titulo={t('channelDiagnostic.title')}
      className="max-w-md mx-auto mt-4"
      acao={
        <>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              // Abrir configurações em nova aba
              window.open(`/settings/inboxes/${inboxId}`, '_blank');
            }}
          >
            <Settings className="h-4 w-4 mr-1" />
            {t('channelDiagnostic.settings')}
          </Button>

          <Button size="sm" variant="ghost" onClick={onClose} className="flex-1">
            {t('channelDiagnostic.close')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p>{t('channelDiagnostic.description')}</p>

        <div className="flex items-center gap-2">
          <span className="font-medium">{t('channelDiagnostic.inboxId')}</span>
          <span>#{inboxId}</span>
        </div>

        <div>
          <p className="font-medium mb-1">{t('channelDiagnostic.possibleSolutions')}</p>
          <ul className="space-y-1">
            <li>• {t('channelDiagnostic.solutions.checkChannel')}</li>
            <li>• {t('channelDiagnostic.solutions.confirmCredentials')}</li>
            <li>• {t('channelDiagnostic.solutions.testConnectivity')}</li>
            <li>• {t('channelDiagnostic.solutions.checkWebhooks')}</li>
          </ul>
        </div>
      </div>
    </Aviso>
  );
};

export default ChannelDiagnostic;
