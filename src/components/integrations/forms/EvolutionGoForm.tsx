import { useLanguage } from '@/hooks/useLanguage';
import { FormField } from '@/components/shared/forms';
import type { IntegrationFormProps } from '@/types/integrations/forms';

export function EvolutionGoForm({ config, onConfigChange }: IntegrationFormProps) {
  const { t } = useLanguage('integrations');

  const getValue = (key: string, defaultValue = '') => {
    const value = config[key];
    return typeof value === 'string' ? value : defaultValue;
  };

  return (
    <div className="space-y-4">
      <FormField
        id="EVOLUTION_GO_API_URL"
        label={t('evolutionGo.apiUrl')}
        value={getValue('evolutionGoApiUrl')}
        onChange={(value) => onConfigChange('evolutionGoApiUrl', value)}
        placeholder={t('evolutionGo.placeholders.apiUrl')}
        type="url"
      />
      <FormField
        id="EVOLUTION_GO_ADMIN_TOKEN"
        label={t('evolutionGo.adminToken')}
        value={getValue('evolutionGoAdminToken')}
        onChange={(value) => onConfigChange('evolutionGoAdminToken', value)}
        placeholder={t('evolutionGo.placeholders.adminToken')}
        type="password"
      />
      <FormField
        id="EVOLUTION_GO_INSTANCE_ID"
        label={t('evolutionGo.instanceId')}
        value={getValue('evolutionGoInstanceId')}
        onChange={(value) => onConfigChange('evolutionGoInstanceId', value)}
        placeholder={t('evolutionGo.placeholders.instanceId')}
      />
      <FormField
        id="EVOLUTION_GO_INSTANCE_TOKEN"
        label={t('evolutionGo.instanceToken')}
        value={getValue('evolutionGoInstanceToken')}
        onChange={(value) => onConfigChange('evolutionGoInstanceToken', value)}
        placeholder={t('evolutionGo.placeholders.instanceToken')}
        type="password"
      />
    </div>
  );
}

