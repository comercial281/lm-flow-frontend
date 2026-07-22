import { useState, useEffect, useCallback } from 'react';
import { Input, Badge, Button } from '@/components/ui/ds';
import { Search, CheckCircle2, XCircle, Link, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/core/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationRecord {
  id: string;
  integration_type: string;
  display_name: string;
  is_enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected_at: string | null;
  config: Record<string, unknown>;
}

// ─── Static catalog ──────────────────────────────────────────────────────────

interface CatalogEntry {
  type: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  configPath?: string; // route in the app
  docsUrl?: string;
  logo: string; // emoji fallback
}

const CATALOG: CatalogEntry[] = [
  {
    type: 'meta_ads',
    name: 'Meta Ads',
    description: 'Integre com Facebook e Instagram Ads para capturar leads diretamente do formulário de anúncios.',
    category: 'Marketing',
    tags: ['leads', 'facebook', 'instagram', 'ads'],
    configPath: '/settings/integrations/meta-ads',
    logo: '📘',
  },
  {
    type: 'whatsapp_evolution',
    name: 'WhatsApp Evolution API',
    description: 'Envio e recepção de mensagens WhatsApp via Evolution API — base do canal de comunicação.',
    category: 'Comunicação',
    tags: ['whatsapp', 'mensagens', 'canal'],
    configPath: '/channels',
    logo: '💬',
  },
  {
    type: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Sincronize contatos, negócios e atividades com o HubSpot.',
    category: 'CRM',
    tags: ['crm', 'contatos', 'pipeline'],
    configPath: '/settings/integrations/hubspot',
    logo: '🟠',
  },
  {
    type: 'rd_station',
    name: 'RD Station',
    description: 'Integre com RD Station Marketing para automações de e-mail e nutrição de leads.',
    category: 'Marketing',
    tags: ['email', 'automação', 'marketing'],
    configPath: '/settings/integrations/rd-station',
    logo: '🔵',
  },
  {
    type: 'studio360',
    name: 'Studio360',
    description: 'Plataforma de gestão para construtoras e imobiliárias. Sincronize imóveis e clientes.',
    category: 'Imobiliário',
    tags: ['imóveis', 'construtora', 'crm-imob'],
    configPath: '/settings/integrations/studio360',
    logo: '🏗️',
  },
  {
    type: 'leadlovers',
    name: 'Leadlovers',
    description: 'Plataforma de automação de marketing. Envie leads capturados para funis de nutrição.',
    category: 'Marketing',
    tags: ['email', 'automação', 'funil'],
    configPath: '/settings/integrations/leadlovers',
    logo: '🎯',
  },
  {
    type: 'portal_zap',
    name: 'Portais imobiliários',
    description: 'Publique imóveis no Grupo ZAP, VivaReal, OLX, Imóvel Web, Chaves na Mão e regionais via feed, e receba os leads no funil.',
    category: 'Imobiliário',
    tags: ['portais', 'zap', 'vivareal', 'olx', 'feed', 'leads'],
    configPath: '/settings/portals',
    logo: '🏘️',
  },
  {
    type: 'orulo',
    name: 'Órulo',
    description: 'Portal de imóveis lançamentos. Sincronize empreendimentos e interesse de compradores.',
    category: 'Imobiliário',
    tags: ['lançamentos', 'empreendimentos', 'portal'],
    configPath: '/settings/integrations/orulo',
    logo: '🏢',
  },
  {
    type: 'zapier',
    name: 'Zapier',
    description: 'Conecte o LM Flow com mais de 5.000 apps via Zapier com webhooks.',
    category: 'Automação',
    tags: ['webhook', 'automação', 'zap'],
    configPath: '/settings/integrations/webhooks',
    logo: '⚡',
  },
  {
    type: 'n8n',
    name: 'n8n',
    description: 'Automações avançadas com n8n self-hosted. Use webhooks para disparar e receber eventos.',
    category: 'Automação',
    tags: ['webhook', 'automação', 'self-hosted'],
    configPath: '/settings/integrations/webhooks',
    logo: '🔄',
  },
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sincronize agendamentos de visitas com Google Calendar e crie eventos Meet automaticamente.',
    category: 'Produtividade',
    tags: ['agenda', 'meet', 'visitas'],
    configPath: '/settings/integrations',
    logo: '📅',
  },
  {
    type: 'openai',
    name: 'OpenAI',
    description: 'Habilite transcrição de áudio (Whisper) e respostas inteligentes com GPT.',
    category: 'IA',
    tags: ['ia', 'gpt', 'transcrição', 'whisper'],
    configPath: '/settings/integrations/openai',
    logo: '🤖',
  },
  {
    type: 'make',
    name: 'Make (Integromat)',
    description: 'Automatize processos complexos com Make. Conecte com qualquer app via webhook.',
    category: 'Automação',
    tags: ['automação', 'webhook', 'make'],
    configPath: '/settings/integrations/webhooks',
    logo: '🔧',
  },
];

const CATEGORIES = ['Todos', ...Array.from(new Set(CATALOG.map(c => c.category)))];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Marketplace() {
  const [records, setRecords] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/integrations');
      setRecords((res.data as { data: IntegrationRecord[] }).data ?? []);
    } catch {
      // If no integrations exist yet, that's fine — show catalog with all disconnected
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getRecord = (type: string) => records.find(r => r.integration_type === type);

  const handleConnect = async (entry: CatalogEntry) => {
    if (entry.configPath) {
      window.location.href = entry.configPath;
      return;
    }

    setConnecting(entry.type);
    try {
      // Try to find existing record or create + connect
      const existing = getRecord(entry.type);
      if (existing) {
        await api.post(`/integrations/${existing.id}/connect`);
        toast.success(`${entry.name} conectado`);
      } else {
        const create = await api.post('/integrations', {
          integration: { integration_type: entry.type, display_name: entry.name },
        });
        const newId = (create.data as { data: { id: string } }).data.id;
        await api.post(`/integrations/${newId}/connect`);
        toast.success(`${entry.name} conectado`);
      }
      await load();
    } catch {
      toast.error(`Erro ao conectar ${entry.name}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (entry: CatalogEntry) => {
    const rec = getRecord(entry.type);
    if (!rec) return;
    setConnecting(entry.type);
    try {
      await api.post(`/integrations/${rec.id}/disconnect`);
      toast.success(`${entry.name} desconectado`);
      await load();
    } catch {
      toast.error(`Erro ao desconectar ${entry.name}`);
    } finally {
      setConnecting(null);
    }
  };

  const filtered = CATALOG.filter(entry => {
    if (category !== 'Todos' && entry.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some(t => t.toLowerCase().includes(q));
  });

  const StatusBadge = ({ type }: { type: string }) => {
    const rec = getRecord(type);
    if (!rec || rec.status === 'disconnected') return null;
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
        rec.status === 'connected'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      }`}>
        {rec.status === 'connected' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {rec.status === 'connected' ? 'Conectado' : rec.status}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur p-6">
        <h1 className="text-2xl font-bold mb-1">Marketplace de Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Conecte o LM Flow com as ferramentas do ecossistema imobiliário
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar integrações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando integrações...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-10 w-10 mb-3" />
            <p className="text-sm">Nenhuma integração encontrada para "{search}"</p>
            <button onClick={() => { setSearch(''); setCategory('Todos'); }} className="text-xs text-primary mt-2 hover:underline">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(entry => {
              const rec = getRecord(entry.type);
              const isConnected = rec?.status === 'connected';
              const isLoading = connecting === entry.type;

              return (
                <div key={entry.type} className="flex flex-col rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                  {/* Logo + category */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-2xl">
                        {entry.logo}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{entry.name}</h3>
                        <span className="text-xs text-muted-foreground">{entry.category}</span>
                      </div>
                    </div>
                    <StatusBadge type={entry.type} />
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-3 flex-1 mb-4">
                    {entry.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {entry.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={isLoading}
                        onClick={() => handleDisconnect(entry)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {isLoading ? 'Desconectando...' : 'Desconectar'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={isLoading}
                        onClick={() => handleConnect(entry)}
                      >
                        <Link className="h-3.5 w-3.5 mr-1" />
                        {isLoading ? 'Conectando...' : entry.configPath ? 'Configurar' : 'Conectar'}
                      </Button>
                    )}
                    {entry.docsUrl && (
                      <Button variant="ghost" size="sm" asChild className="px-2">
                        <a href={entry.docsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
