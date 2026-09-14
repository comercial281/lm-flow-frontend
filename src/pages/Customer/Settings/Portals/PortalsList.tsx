import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Home, Star, Clock, ChevronRight } from 'lucide-react';
import { portalsService, Portal } from '@/services/portals/portalsService';
import { PortalLogo } from '@/components/portals/PortalLogo';
import { PortalStatusBadge, PortalTypeCounters } from '@/components/portals/PortalBadges';
import { temTiposDeAnuncio } from '@/features/portals/adPlan';

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
                className="w-full rounded-xl border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all"
              >
                {/* Linha 1: quem é o portal e em que estado está. O nome tem prioridade
                    de largura — os contadores moram na linha de baixo, senão com seis
                    tipos de anúncio eles tomavam a linha inteira e o nome sumia. */}
                <div className="flex items-center gap-4">
                  <PortalLogo portalKey={portal.portal_key} className="w-12 h-12" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{portal.name}</p>
                      <PortalStatusBadge portal={portal} />
                    </div>
                    {!portal.connected && (
                      <p className="text-xs text-muted-foreground">Não conectado — clique para configurar</p>
                    )}
                  </div>

                  <div className="hidden sm:block text-center shrink-0">
                    <div className="flex items-center justify-center gap-1.5 text-primary text-sm font-semibold">
                      <Clock className="h-4 w-4" />
                      {portal.connected ? lastUpdateLabel(portal) : '—'}
                    </div>
                    <p className="text-[11px] text-muted-foreground">última atualização</p>
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
                </div>

                {/* Linha 2: os números, alinhados com o texto (logo + gap = 4rem). Os
                    contadores por tipo quebram linha em vez de espremer o resto. */}
                <div className="mt-3 sm:pl-16 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Home className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">{portal.sent_count}</span>
                    <span className="text-muted-foreground">imóveis enviados</span>
                  </div>
                  {temTiposDeAnuncio(portal) ? (
                    // Um contador por tipo de anúncio, com o estourado em vermelho.
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <PortalTypeCounters adTypes={portal.ad_types ?? []} className="font-semibold text-primary" />
                      <span className="text-muted-foreground text-[11px]">por tipo de anúncio</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="font-bold text-primary">{portal.featured_count}</span>
                      <span className="text-muted-foreground">em destaque</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
