import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Home, Star, Clock, ChevronRight } from 'lucide-react';
import { portalsService, Portal, PORTAL_LOGOS } from '@/services/portals/portalsService';

function lastUpdateLabel(portal: Portal): string {
  if (!portal.last_accessed_at) return 'aguardando portal';
  const date = new Date(portal.last_accessed_at);
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Painel de portais imobiliários — cards com contadores de imóveis enviados,
// destaques e última leitura do feed pelo portal (estilo Tecimob/Jetimob).
export default function PortalsList() {
  const navigate = useNavigate();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPortals(await portalsService.list());
    } catch {
      toast.error('Erro ao carregar portais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur p-6">
        <h1 className="text-2xl font-bold">Portais imobiliários</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Publique seus imóveis automaticamente nos portais e receba os leads direto no funil.
          Cada portal lê o feed do LM Flow algumas vezes por dia.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : (
          <div className="space-y-3 max-w-5xl">
            {portals.map(portal => (
              <button
                key={portal.portal_key}
                onClick={() => navigate(`/settings/portals/${portal.portal_key}`)}
                className="w-full flex items-center gap-4 rounded-xl border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl border shrink-0">
                  {PORTAL_LOGOS[portal.portal_key] ?? '🌐'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{portal.name}</p>
                  {!portal.connected && (
                    <p className="text-xs text-muted-foreground">Não conectado — clique para configurar</p>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-10 shrink-0">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 text-primary font-bold text-lg">
                      <Home className="h-4 w-4" />
                      {portal.sent_count}
                    </div>
                    <p className="text-[11px] text-muted-foreground">imóveis enviados</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 text-primary font-bold text-lg">
                      <Star className="h-4 w-4" />
                      {portal.featured_count}
                    </div>
                    <p className="text-[11px] text-muted-foreground">em destaque</p>
                  </div>
                  <div className="text-center min-w-32">
                    <div className="flex items-center justify-center gap-1.5 text-primary text-sm font-semibold">
                      <Clock className="h-4 w-4" />
                      {portal.connected ? lastUpdateLabel(portal) : '—'}
                    </div>
                    <p className="text-[11px] text-muted-foreground">última atualização</p>
                  </div>
                </div>

                <span
                  className={`shrink-0 text-xs font-bold tracking-wide ${
                    portal.active
                      ? 'text-green-600 dark:text-green-400'
                      : portal.connected
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {portal.active ? 'ATIVO' : portal.connected ? 'AGUARDANDO' : 'INATIVO'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
