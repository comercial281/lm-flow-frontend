import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
} from '@evoapi/design-system';
import { useLanguage } from '@/hooks/useLanguage';
import type { KnowledgeNexusConfig } from '@/hooks/useIntegrations';

export type { KnowledgeNexusConfig };

interface KnowledgeNexusConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: KnowledgeNexusConfig) => void;
  onDeactivate?: () => void;
  initialConfig?: Partial<KnowledgeNexusConfig>;
}

const DEFAULT_TOP_K = 10;
const DEFAULT_TIMEOUT = 15;

interface DialogState {
  nexus_base_url: string;
  nexus_api_key: string;
  space_id: string;
  default_top_k: number;
  timeout_seconds: number;
}

const KnowledgeNexusConfigDialog = ({
  open,
  onOpenChange,
  onSave,
  onDeactivate,
  initialConfig,
}: KnowledgeNexusConfigDialogProps) => {
  const { t } = useLanguage('aiAgents');

  // Backend strips `nexus_api_key` before returning the config (defense-in-depth
  // in useIntegrations.sanitizeConfig). When `connected === true` but the key
  // is absent in initialConfig, the user has a saved key — render a hint and
  // let them leave the field blank to keep the existing key.
  const hasSavedApiKey = Boolean(initialConfig?.connected) && !initialConfig?.nexus_api_key;

  const [config, setConfig] = useState<DialogState>({
    nexus_base_url: initialConfig?.nexus_base_url || '',
    nexus_api_key: initialConfig?.nexus_api_key || '',
    space_id: initialConfig?.space_id || '',
    default_top_k: initialConfig?.default_top_k ?? DEFAULT_TOP_K,
    timeout_seconds: initialConfig?.timeout_seconds ?? DEFAULT_TIMEOUT,
  });

  // Reset state whenever the dialog opens so abandoned edits don't persist
  // across opens and a freshly loaded `initialConfig` is honored.
  useEffect(() => {
    if (open) {
      setConfig({
        nexus_base_url: initialConfig?.nexus_base_url || '',
        nexus_api_key: '',
        space_id: initialConfig?.space_id || '',
        default_top_k: initialConfig?.default_top_k ?? DEFAULT_TOP_K,
        timeout_seconds: initialConfig?.timeout_seconds ?? DEFAULT_TIMEOUT,
      });
    }
  }, [open, initialConfig]);

  const apiKeyOk = config.nexus_api_key.trim() !== '' || hasSavedApiKey;
  const isValid =
    config.nexus_base_url.trim() !== '' && apiKeyOk && config.space_id.trim() !== '';

  const handleSave = () => {
    const payload: KnowledgeNexusConfig = {
      connected: true,
      nexus_base_url: config.nexus_base_url.trim(),
      space_id: config.space_id.trim(),
      default_top_k: config.default_top_k,
      timeout_seconds: config.timeout_seconds,
    };
    // Only include the API key when the user actually typed one; leaving it
    // blank means "keep whatever is stored on the backend".
    const typedKey = config.nexus_api_key.trim();
    if (typedKey) {
      payload.nexus_api_key = typedKey;
    }
    onSave(payload);
    onOpenChange(false);
  };

  const handleDeactivate = () => {
    onDeactivate?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('edit.integrations.knowledgeNexus.configTitle') || 'Configurar Knowledge Nexus'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t('edit.integrations.knowledgeNexus.intro') ||
              'Conecte este agente a uma base de conhecimento do EvoNexus para que ele possa buscar informações curadas antes de responder.'}
          </p>

          <div className="space-y-2">
            <Label htmlFor="nexus_base_url">
              {t('edit.integrations.knowledgeNexus.baseUrl') || 'URL base do Nexus'}
            </Label>
            <Input
              id="nexus_base_url"
              type="text"
              placeholder="https://nexus.suaempresa.com"
              value={config.nexus_base_url}
              onChange={e => setConfig({ ...config, nexus_base_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('edit.integrations.knowledgeNexus.baseUrlHint') ||
                'Endereço do dashboard EvoNexus (sem barra no final).'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nexus_api_key">
              {t('edit.integrations.knowledgeNexus.apiKey') || 'API Key'}
            </Label>
            <Input
              id="nexus_api_key"
              type="password"
              placeholder={
                hasSavedApiKey
                  ? t('edit.integrations.knowledgeNexus.apiKeySavedPlaceholder') ||
                    'Deixe em branco para manter a chave salva'
                  : 'evo_k_...'
              }
              value={config.nexus_api_key}
              onChange={e => setConfig({ ...config, nexus_api_key: e.target.value })}
            />
            {hasSavedApiKey ? (
              <p className="text-xs text-green-600">
                {t('edit.integrations.knowledgeNexus.apiKeySaved') ||
                  '✓ Chave já configurada — deixe em branco para manter, redigite para substituir.'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('edit.integrations.knowledgeNexus.apiKeyHint') ||
                  'Chave de API gerada no Nexus em Knowledge → API Keys. Formato evo_k_<prefix>.<secret>.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="space_id">
              {t('edit.integrations.knowledgeNexus.spaceId') || 'Space ID'}
            </Label>
            <Input
              id="space_id"
              type="text"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={config.space_id}
              onChange={e => setConfig({ ...config, space_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('edit.integrations.knowledgeNexus.spaceIdHint') ||
                'UUID da knowledge space que será consultada por este agente.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_top_k">
                {t('edit.integrations.knowledgeNexus.topK') || 'Top K (padrão)'}
              </Label>
              <Input
                id="default_top_k"
                type="number"
                min={1}
                max={50}
                value={config.default_top_k ?? DEFAULT_TOP_K}
                onChange={e =>
                  setConfig({
                    ...config,
                    default_top_k: Math.max(1, Math.min(50, Number(e.target.value) || DEFAULT_TOP_K)),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout_seconds">
                {t('edit.integrations.knowledgeNexus.timeout') || 'Timeout (s)'}
              </Label>
              <Input
                id="timeout_seconds"
                type="number"
                min={1}
                max={60}
                value={config.timeout_seconds ?? DEFAULT_TIMEOUT}
                onChange={e =>
                  setConfig({
                    ...config,
                    timeout_seconds: Math.max(
                      1,
                      Math.min(60, Number(e.target.value) || DEFAULT_TIMEOUT)
                    ),
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleSave} disabled={!isValid} className="w-full">
              {t('edit.integrations.knowledgeNexus.apply') || 'APLICAR CONFIGURAÇÕES'}
            </Button>

            {onDeactivate && (
              <Button
                variant="ghost"
                onClick={handleDeactivate}
                className="w-full text-destructive hover:text-destructive/80"
              >
                {t('edit.integrations.knowledgeNexus.deactivate') || 'Desativar integração'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeNexusConfigDialog;
