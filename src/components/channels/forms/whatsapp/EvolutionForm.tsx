import { useLanguage } from '@/hooks/useLanguage';
import { FormField } from '../../shared/FormField';
import { FormData } from '@/hooks/channels/useChannelForm';
import  { sanitizeInboxName } from '@/utils/sanitizeName';
import { PhoneInput } from '@/components/shared/PhoneInput';

interface EvolutionFormProps {
  form: FormData;
  onFormChange: (key: string, value: string | boolean) => void;
  hasEvolutionConfig: boolean;
}

export const EvolutionForm = ({ form, onFormChange, hasEvolutionConfig }: EvolutionFormProps) => {
  const { t } = useLanguage('whatsapp');
  const getStr = (key: string, fallback = ''): string =>
    typeof form[key] === 'string' ? (form[key] as string) : fallback;

  const handleDisplayNameChange = (value: string) => {
    onFormChange('display_name', value);
    onFormChange('name', sanitizeInboxName(value));
  };

  return (
    <div className="space-y-6">
      {/* Basic Configuration - Only show API/Token if not auto-filled */}
      {!hasEvolutionConfig && (
        <>
          <FormField
            label={t('evolutionForm.fields.baseUrl.label')}
            value={getStr('api_url')}
            onChange={value => onFormChange('api_url', value)}
            placeholder={t('evolutionForm.fields.baseUrl.placeholder')}
            type="url"
            required
          />

          <FormField
            label={t('evolutionForm.fields.apiKey.label')}
            value={getStr('admin_token')}
            onChange={value => onFormChange('admin_token', value)}
            placeholder={t('evolutionForm.fields.apiKey.placeholder')}
            type="password"
            required
          />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="whatsapp-credentials">
        <FormField
          label={t('evolutionForm.fields.displayName.label')}
          value={getStr('display_name')}
          onChange={handleDisplayNameChange}
          placeholder={t('evolutionForm.fields.displayName.placeholder')}
          helpText={t('evolutionForm.fields.displayName.helpText')}
          required
        />
        <FormField
          label={t('evolutionForm.fields.channelName.label')}
          value={getStr('name')}
          onChange={value => onFormChange('name', value)}
          placeholder={t('evolutionForm.fields.channelName.placeholder')}
          helpText={t('evolutionForm.fields.channelName.helpText')}
          required
          readOnly
        />
      </div>

      <div>
        <label className="text-sm font-medium text-sidebar-foreground/80 block mb-1">
          {t('twilioForm.fields.phoneNumber.label')} <span className="text-destructive">*</span>
        </label>
        <PhoneInput
          value={getStr('phone_number')}
          onChange={value => onFormChange('phone_number', value)}
          placeholder={t('twilioForm.fields.phoneNumber.placeholder')}
          defaultCountry="BR"
        />
      </div>

      {/* Proxy e Configurações do número saíram da tela em 08/10/26: o canal
          nasce com os valores de fábrica do useChannelForm e ninguém mexe.
          Ver "Configurações do número escondidas" no CLAUDE.md. */}
    </div>
  );
};
