import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Input, Label } from '@/components/ui/ds';
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink, LucideIcon } from 'lucide-react';
import api from '@/services/core/api';

interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  hint?: string;
}

interface IntegrationRecord {
  id: string;
  integration_type: string;
  display_name: string;
  is_enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected_at: string | null;
  config: Record<string, string>;
}

interface Props {
  integrationType: string;
  displayName: string;
  description: string;
  logo: string;
  icon: LucideIcon;
  configFields: ConfigField[];
  docsUrl?: string;
  onBack?: () => void;
}

export default function RealEstateIntegrationPage({
  integrationType,
  displayName,
  description,
  logo,
  configFields,
  docsUrl,
  onBack,
}: Props) {
  const navigate = useNavigate();
  const [record, setRecord] = useState<IntegrationRecord | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleBack = onBack ?? (() => navigate('/settings/integrations'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/integrations');
      const records = (res.data as { data: IntegrationRecord[] }).data ?? [];
      const found = records.find(r => r.integration_type === integrationType);
      setRecord(found ?? null);
      if (found?.config) {
        setConfig(Object.fromEntries(
          Object.entries(found.config).map(([k, v]) => [k, String(v)])
        ));
      }
    } catch {
      // integration doesn't exist yet
    } finally {
      setLoading(false);
    }
  }, [integrationType]);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async () => {
    setSaving(true);
    try {
      if (record) {
        await api.post(`/integrations/${record.id}/connect`, { config });
        toast.success(`${displayName} conectado com sucesso`);
      } else {
        const createRes = await api.post('/integrations', {
          integration: { integration_type: integrationType, display_name: displayName },
        });
        const newId = (createRes.data as { data: { id: string } }).data.id;
        await api.post(`/integrations/${newId}/connect`, { config });
        toast.success(`${displayName} conectado com sucesso`);
      }
      await load();
    } catch {
      toast.error(`Erro ao conectar ${displayName}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await api.post(`/integrations/${record.id}/disconnect`);
      toast.success(`${displayName} desconectado`);
      await load();
    } catch {
      toast.error(`Erro ao desconectar ${displayName}`);
    } finally {
      setSaving(false);
    }
  };

  const isConnected = record?.status === 'connected';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur p-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Marketplace
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-3xl border">
              {logo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Conectado
                  </span>
                )}
                {record?.status === 'error' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="h-3 w-3" />
                    Erro
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">{description}</p>
            </div>
          </div>

          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Documentação
            </a>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : (
          <div className="max-w-xl space-y-6">
            {/* Config fields */}
            {configFields.length > 0 && (
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <h2 className="font-semibold text-sm">Configuração</h2>

                {configFields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key} className="text-sm">{field.label}</Label>
                    <Input
                      id={field.key}
                      type={field.type ?? 'text'}
                      placeholder={field.placeholder}
                      value={config[field.key] ?? ''}
                      onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                    {field.hint && (
                      <p className="text-xs text-muted-foreground">{field.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Connection info when connected */}
            {isConnected && record?.connected_at && (
              <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Conectado em{' '}
                  {new Date(record.connected_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {isConnected ? (
                <>
                  <Button
                    onClick={handleConnect}
                    disabled={saving}
                    variant="outline"
                    className="text-sm"
                  >
                    {saving ? 'Salvando...' : 'Atualizar configuração'}
                  </Button>
                  <Button
                    onClick={handleDisconnect}
                    disabled={saving}
                    variant="outline"
                    className="text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {saving ? 'Desconectando...' : 'Desconectar'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={saving}
                  className="text-sm"
                >
                  {saving ? 'Conectando...' : 'Conectar'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
