import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, Button, Input, Skeleton } from '@/components/ui/ds';
import { MessageSquare, Key, Shield, Bot } from 'lucide-react';
import InboxesService from '@/services/channels/inboxesService';
import type { TelegramChannelPayload } from '@/types/channels/inbox';
import { useLanguage } from '@/hooks/useLanguage';
import Aviso from '@/components/base/Aviso';

interface TelegramFormProps {
  onSuccess: (channelId: string) => void;
  onBack: () => void;
}

const TelegramForm: React.FC<TelegramFormProps> = ({ onSuccess, onBack }) => {
  const { t } = useLanguage('channels');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bot_token: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = t('newChannel.forms.telegramForm.validation.nameRequired');
    }

    if (!formData.bot_token) {
      newErrors.bot_token = t('newChannel.forms.telegramForm.validation.botTokenRequired');
    } else if (!formData.bot_token.match(/^\d+:[a-zA-Z0-9_-]+$/)) {
      newErrors.bot_token = t('newChannel.forms.telegramForm.validation.botTokenFormat');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error(t('newChannel.forms.telegramForm.validation.fillAllFields'));
      return;
    }

    setIsLoading(true);
    try {
      const payload: TelegramChannelPayload = {
        name: formData.name,
        channel: {
          type: 'telegram',
          bot_token: formData.bot_token,
        },
      };

      const result = await InboxesService.create(payload);
      toast.success(t('newChannel.forms.telegramForm.success.created'));
      onSuccess(result.data.id);
    } catch (error) {
      console.error('Erro ao criar canal Telegram:', error);
      toast.error(t('newChannel.forms.telegramForm.errors.createError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← {t('newChannel.forms.telegramForm.backButton')}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('newChannel.forms.telegramForm.title')}</h1>
          <p className="text-muted-foreground">{t('newChannel.forms.telegramForm.description')}</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                {t('newChannel.forms.telegramForm.fields.basicInfo')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('newChannel.forms.telegramForm.fields.name.label')} *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('newChannel.forms.telegramForm.fields.name.placeholder')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
                </div>
              </div>
            </div>

            {/* Bot Configuration */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                {t('newChannel.forms.telegramForm.fields.botConfiguration')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('newChannel.forms.telegramForm.fields.botToken.label')} *
                  </label>
                  <Input
                    type="password"
                    value={formData.bot_token}
                    onChange={e => setFormData(prev => ({ ...prev, bot_token: e.target.value }))}
                    placeholder={t('newChannel.forms.telegramForm.fields.botToken.placeholder')}
                    className={errors.bot_token ? 'border-destructive' : ''}
                  />
                  {errors.bot_token && (
                    <p className="text-destructive text-sm mt-1">{errors.bot_token}</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('newChannel.forms.telegramForm.fields.botToken.helpText')}
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <Aviso
              tom="info"
              icone={Shield}
              titulo={t('newChannel.forms.telegramForm.instructions.title')}
            >
              <p>{t('newChannel.forms.telegramForm.instructions.step1')}</p>
              <p>{t('newChannel.forms.telegramForm.instructions.step2')}</p>
              <p>{t('newChannel.forms.telegramForm.instructions.step3')}</p>
              <p>{t('newChannel.forms.telegramForm.instructions.step4')}</p>
              <p>{t('newChannel.forms.telegramForm.instructions.step5')}</p>
              <p>{t('newChannel.forms.telegramForm.instructions.step6')}</p>
            </Aviso>

            {/* Webhook Info */}
            <Aviso
              tom="sucesso"
              icone={Key}
              titulo={t('newChannel.forms.telegramForm.webhook.title')}
            >
              <p>{t('newChannel.forms.telegramForm.webhook.description')}</p>
              <code className="block bg-background/60 p-2 rounded mt-1">
                {window.location.origin}/api/v1/webhooks/telegram
              </code>
              <p>{t('newChannel.forms.telegramForm.webhook.note')}</p>
            </Aviso>

            {/* Bot Commands */}
            <Aviso tom="neutro" titulo={t('newChannel.forms.telegramForm.commands.title')}>
              <p>{t('newChannel.forms.telegramForm.commands.description')}</p>
              <code className="block bg-background/60 p-2 rounded mt-1 whitespace-pre-line">
                {t('newChannel.forms.telegramForm.commands.list')}
              </code>
            </Aviso>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-4 mr-2" />
              {t('newChannel.forms.telegramForm.creating')}
            </>
          ) : (
            t('newChannel.forms.telegramForm.createButton')
          )}
        </Button>
      </div>
    </div>
  );
};

export default TelegramForm;
