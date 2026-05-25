import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Input,
  Label,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { adminConfigService } from '@/services/admin/adminConfigService';
import type { AdminConfigData } from '@/types/admin/adminConfig';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import { extractError } from '@/utils/apiHelpers';

const CONFIG_TYPE = 'evolution_hub';
const MASKED = '••••';

function errorMessage(e: unknown, fallback: string): string {
  const info = extractError(e);
  return info?.message || fallback;
}

function generateSecret(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const schema = z.object({
  EVOLUTION_HUB_ENABLED: z.union([z.string(), z.boolean()]).optional(),
  EVOLUTION_HUB_URL: z.string().url('URL inválida').or(z.literal('')),
  EVOLUTION_HUB_API_KEY: z.string().optional().nullable(),
  EVOLUTION_HUB_WEBHOOK_SECRET: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  EVOLUTION_HUB_ENABLED: 'false',
  EVOLUTION_HUB_URL: '',
  EVOLUTION_HUB_API_KEY: null,
  EVOLUTION_HUB_WEBHOOK_SECRET: null,
};

function isMasked(v: unknown): boolean {
  return typeof v === 'string' && v.includes(MASKED);
}

export default function EvolutionHubConfig() {
  const { t } = useLanguage('adminSettings');
  const { refresh } = useGlobalConfig() as unknown as { refresh?: () => Promise<void> };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [webhookSecretConfigured, setWebhookSecretConfigured] = useState(false);
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [secretTouched, setSecretTouched] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const enabledValue = watch('EVOLUTION_HUB_ENABLED');
  const enabledBool =
    enabledValue === true || enabledValue === 'true';

  useEffect(() => {
    (async () => {
      try {
        const data = await adminConfigService.getConfig(CONFIG_TYPE);
        const cfg = (data ?? {}) as Record<string, unknown>;
        setApiKeyConfigured(isMasked(cfg.EVOLUTION_HUB_API_KEY));
        setWebhookSecretConfigured(isMasked(cfg.EVOLUTION_HUB_WEBHOOK_SECRET));
        reset({
          EVOLUTION_HUB_ENABLED: String(cfg.EVOLUTION_HUB_ENABLED ?? 'false'),
          EVOLUTION_HUB_URL: (cfg.EVOLUTION_HUB_URL as string) ?? '',
          EVOLUTION_HUB_API_KEY: null,
          EVOLUTION_HUB_WEBHOOK_SECRET: null,
        });
      } catch (e) {
        toast.error(errorMessage(e, t('evolutionHub.messages.loadError')));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    try {
      const payload: AdminConfigData = {
        EVOLUTION_HUB_ENABLED: String(values.EVOLUTION_HUB_ENABLED),
        EVOLUTION_HUB_URL: values.EVOLUTION_HUB_URL || '',
      };
      // Preserve existing secrets when the field wasn't touched.
      if (apiKeyTouched) {
        payload.EVOLUTION_HUB_API_KEY = values.EVOLUTION_HUB_API_KEY ?? '';
      }
      if (secretTouched) {
        payload.EVOLUTION_HUB_WEBHOOK_SECRET = values.EVOLUTION_HUB_WEBHOOK_SECRET ?? '';
      }
      await adminConfigService.saveConfig(CONFIG_TYPE, payload);
      toast.success(t('evolutionHub.messages.saved'));
      if (refresh) await refresh();
      setApiKeyTouched(false);
      setSecretTouched(false);
      if (payload.EVOLUTION_HUB_API_KEY) setApiKeyConfigured(true);
      if (payload.EVOLUTION_HUB_WEBHOOK_SECRET) setWebhookSecretConfigured(true);
    } catch (e) {
      toast.error(errorMessage(e, t('evolutionHub.messages.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminConfigService.testConnection(CONFIG_TYPE);
      setTestResult({
        ok: Boolean(result?.success),
        message: String(result?.message ?? t('evolutionHub.messages.testUnknown')),
      });
    } catch (e) {
      setTestResult({ ok: false, message: errorMessage(e, t('evolutionHub.messages.testError')) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('evolutionHub.title')}</h1>
        <p className="text-muted-foreground">{t('evolutionHub.description')}</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('evolutionHub.sections.connection')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="enabled" className="text-base">
                  {t('evolutionHub.fields.enabled')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('evolutionHub.fields.enabledHelp')}
                </p>
              </div>
              <input
                id="enabled"
                type="checkbox"
                checked={enabledBool}
                onChange={(e) => {
                  const next = e.target.checked;
                  setValue('EVOLUTION_HUB_ENABLED', next ? 'true' : 'false');
                  if (next && !webhookSecretConfigured && !secretTouched) {
                    setValue('EVOLUTION_HUB_WEBHOOK_SECRET', generateSecret());
                    setSecretTouched(true);
                  }
                }}
                className="h-5 w-5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">{t('evolutionHub.fields.url')}</Label>
              <Input
                id="url"
                placeholder="https://api.evohub.ai"
                {...register('EVOLUTION_HUB_URL')}
              />
              {errors.EVOLUTION_HUB_URL && (
                <p className="text-sm text-destructive">{errors.EVOLUTION_HUB_URL.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">
                {t('evolutionHub.fields.apiKey')}
                {apiKeyConfigured && !apiKeyTouched && (
                  <span className="ml-2 text-xs text-muted-foreground">({t('evolutionHub.fields.secretSet')})</span>
                )}
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={apiKeyConfigured ? MASKED.repeat(4) : 'evh_pk_...'}
                {...register('EVOLUTION_HUB_API_KEY', {
                  onChange: () => setApiKeyTouched(true),
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret">
                {t('evolutionHub.fields.webhookSecret')}
                {webhookSecretConfigured && !secretTouched && (
                  <span className="ml-2 text-xs text-muted-foreground">({t('evolutionHub.fields.secretSet')})</span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="webhookSecret"
                  type="password"
                  placeholder={webhookSecretConfigured ? MASKED.repeat(4) : t('evolutionHub.fields.webhookSecretPlaceholder')}
                  {...register('EVOLUTION_HUB_WEBHOOK_SECRET', {
                    onChange: () => setSecretTouched(true),
                  })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setValue('EVOLUTION_HUB_WEBHOOK_SECRET', generateSecret());
                    setSecretTouched(true);
                  }}
                  title={t('evolutionHub.actions.generateSecret')}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('evolutionHub.fields.webhookSecretHelp')}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('evolutionHub.actions.save')}
          </Button>

          <Button type="button" variant="outline" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('evolutionHub.actions.test')}
          </Button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              testResult.ok ? 'border-green-500/30 bg-green-500/10' : 'border-destructive/30 bg-destructive/10'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
