import { Switch } from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import Aviso from '@/components/base/Aviso';

interface LockFormData {
  lock_to_single_conversation: boolean;
}

interface LockToSingleConversationFormProps {
  formData: LockFormData;
  onFormChange: (updates: Partial<LockFormData>) => void;
}

export default function LockToSingleConversationForm({
  formData,
  onFormChange,
}: LockToSingleConversationFormProps) {
  const { t } = useLanguage('channels');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h4 className="font-semibold text-foreground">{t('settings.lockToSingleConversation.title')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('settings.lockToSingleConversation.description')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div>
          <label className="text-sm font-medium text-foreground">
            {t('settings.lockToSingleConversation.enable.label')}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('settings.lockToSingleConversation.enable.description')}
          </p>
        </div>
        <Switch
          checked={formData.lock_to_single_conversation}
          onCheckedChange={(checked) => onFormChange({ lock_to_single_conversation: checked })}
        />
      </div>

      {/* Info Box */}
      <Aviso tom="info" titulo={t('settings.lockToSingleConversation.info.title')}>
        <p>• <strong>{t('settings.lockToSingleConversation.info.enabled.title')}:</strong> {t('settings.lockToSingleConversation.info.enabled.description')}</p>
        <p>• <strong>{t('settings.lockToSingleConversation.info.disabled.title')}:</strong> {t('settings.lockToSingleConversation.info.disabled.description')}</p>
        <p>• <strong>{t('settings.lockToSingleConversation.info.recommended.title')}:</strong> {t('settings.lockToSingleConversation.info.recommended.description')}</p>
      </Aviso>
    </div>
  );
}
