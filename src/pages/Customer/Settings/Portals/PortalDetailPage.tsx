import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import {
  ArrowLeft, CheckCircle2, Copy, RefreshCw, Home, Star, Clock, Mail, Webhook,
} from 'lucide-react';
import api from '@/services/core/api';
import { portalsService, PortalDetail, PORTAL_LOGOS } from '@/services/portals/portalsService';
import PortalPropertiesSelector from './PortalPropertiesSelector';

function CopyRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Copy }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiada`);
  };
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate">{value}</code>
        <Button variant="outline" className="text-xs shrink-0" onClick={copy}>
          <Copy className="h-3.5 w-3.5 mr-1" />
          Copiar
        </Button>
      </div>
    </div>
  );
}

// Configuração de um portal: conectar, URL do feed pra colar no painel do
// portal, webhook de leads e seleção de imóveis/destaques.
export default function PortalDetailPage() {
  const navigate = useNavigate();
  const { portalKey = '' } = useParams();
  const [portal, setPortal] = useState<PortalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPortal(await portalsService.get(portalKey));
    } catch {
      toast.error('Erro ao carregar portal');
    } finally {
      setLoading(false);
    }
  }, [portalKey]);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async () => {
    if (!portal) return;
    setSaving(true);
    try {
      let id = portal.integration_id;
      if (!id) {
        const res = await api.post('/integrations', {
          integration: { integration_type: portal.portal_key, display_name: portal.name },
        });
        id = (res.data as { data: { id: string } }).data.id;
      }
      await api.post(`/integrations/${id}/connect`, { config: {} });
      toast.success(`${portal.name} conectado`);
      await load();
    } catch {
      toast.error('Erro ao conectar portal');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!portal?.integration_id) return;
    setSaving(true);
    try {
      await api.post(`/integrations/${portal.integration_id}/disconnect`);
      toast.success(`${portal.name} desconectado`);
      await load();
    } catch {
      toast.error('Erro ao desconectar portal');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!window.confirm('Rotacionar o token invalida a URL atual do feed — será preciso atualizar no painel do portal. Continuar?')) return;
    try {
      await portalsService.regenerateToken(portalKey);
      toast.success('Token rotacionado — atualize a URL no painel do portal');
      await load();
    } catch {
      toast.error('Erro ao rotacionar token');
    }
  };

  if (loading || !portal) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur p-6">
        <button
          onClick={() => navigate('/settings/portals')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos Portais
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-3xl border">
            {PORTAL_LOGOS[portal.portal_key] ?? '🌐'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{portal.name}</h1>
              {portal.active ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  ATIVO
                </span>
              ) : portal.connected ? (
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Aguardando o portal baixar o feed
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-5 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{portal.sent_count} enviados</span>
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{portal.featured_count} em destaque</span>
              {portal.last_accessed_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(portal.last_accessed_at).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          {portal.connected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={saving}
              className="text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {saving ? 'Desconectando...' : 'Desconectar'}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={saving} className="text-sm">
              {saving ? 'Conectando...' : 'Conectar portal'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {portal.connected && (
          <div className="rounded-xl border bg-card p-6 space-y-5 max-w-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Integração com o portal</h2>
              <Button variant="outline" className="text-xs" onClick={handleRegenerateToken}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Rotacionar token
              </Button>
            </div>

            {portal.feed_url && (
              <CopyRow label="URL do feed de imóveis" value={portal.feed_url} icon={Home} />
            )}
            {portal.lead_webhook_url && (
              <CopyRow label="URL de webhook de leads" value={portal.lead_webhook_url} icon={Webhook} />
            )}
            {portal.capabilities.includes('email_leads') && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Este portal envia leads por e-mail. Cadastre no portal o e-mail de captação da sua
                caixa de entrada de leads no LM Flow (recurso em implantação).
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-card p-6 max-w-3xl">
          <h2 className="font-semibold text-sm mb-3">Como ativar</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal ml-4">
            {portal.onboarding.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {portal.connected && (
          <div className="max-w-3xl">
            <PortalPropertiesSelector
              portalKey={portal.portal_key}
              supportsHighlight={portal.capabilities.includes('highlight')}
              initialSelected={portal.property_ids}
              initialFeatured={portal.featured_property_ids}
              onSaved={load}
            />
          </div>
        )}
      </div>
    </div>
  );
}
