import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import BaseStatusBadge from '@/components/base/BaseStatusBadge';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Card } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { portalsService, Portal } from '@/services/portals/portalsService';
import { PortalLogo } from '@/components/portals/PortalLogo';
import { temTiposDeAnuncio } from '@/features/portals/adPlan';
import { resumoDaCota, situacaoDoPortal } from '@/features/portals/situacao';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import CartaoDeLink from '../Integrations/CartaoDeLink';

const COR_DA_COTA = { neutro: 'text-muted-foreground', atencao: 'text-amber-700 dark:text-amber-400', erro: 'text-destructive' } as const;

const rotaDoPortal = (portal: Portal) => `/settings/portals/${portal.portal_key}`;

/** Uma linha de portal conectado: quem é, a situação, e os números que importam. */
function LinhaConectado({ portal }: { portal: Portal }) {
  const situacao = situacaoDoPortal(portal);
  const cota = temTiposDeAnuncio(portal) ? resumoDaCota(portal.ad_types ?? []) : null;
  return (
    <li>
      <Link
        to={rotaDoPortal(portal)}
        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <PortalLogo portalKey={portal.portal_key} className="w-11 h-11" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{portal.name}</span>
            <BaseStatusBadge status={situacao.selo} text={situacao.rotulo} />
          </div>
          <p className={cn('text-sm', situacao.chave === 'parou' ? 'text-destructive' : 'text-muted-foreground')}>
            {situacao.detalhe}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="font-semibold">{plural(portal.sent_count, 'imóvel', 'imóveis')}</p>
          {cota && <p className={cn('text-xs', COR_DA_COTA[cota.tom])}>{cota.texto}</p>}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

// Portais (redesenho de 12/10/2026, opção A): os conectados em cima, numa lista
// com UMA situação por portal; embaixo, os que dá pra conectar, em cartões.
// Antes eram 11 cartões iguais, com quatro sinais de estado e seis contadores
// zerados cada. Conectar é dentro da página do portal (o passo a passo).
export default function PortalsList() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const carga = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++carga.current;
    setLoading(true);
    setErro(false);
    setRecusado(false);
    try {
      const lista = await portalsService.list();
      if (minha === carga.current) setPortals(lista);
    } catch (e) {
      if (minha !== carga.current) return;
      if (isForbiddenError(e)) setRecusado(true);
      else setErro(true);
    } finally {
      if (minha === carga.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const conectados = portals.filter(p => p.connected);
  const disponiveis = portals.filter(p => !p.connected);

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Portais"
          subtitle="Seus imóveis nos portais e os leads direto no funil."
        />
      }
    >
      {recusado ? (
        <NoAccessState />
      ) : loading ? (
        <Carregando linhas={4} rotulo="Carregando portais…" />
      ) : erro ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />
      ) : (
        <div className="space-y-8">
          {conectados.length > 0 && (
            <section className="space-y-3" aria-labelledby="portais-conectados">
              <h2 id="portais-conectados" className="text-base font-semibold">
                Conectados <span className="font-medium text-muted-foreground">· {conectados.length}</span>
              </h2>
              <Card className="gap-0 overflow-hidden py-0">
                <ul className="divide-y divide-border">
                  {conectados.map(p => <LinhaConectado key={p.portal_key} portal={p} />)}
                </ul>
              </Card>
            </section>
          )}

          {disponiveis.length > 0 && (
            <section className="space-y-3" aria-labelledby="portais-disponiveis">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="portais-disponiveis" className="text-base font-semibold">Adicionar portal</h2>
                <p className="text-sm text-muted-foreground">
                  Você contrata o plano com o portal; aqui só liga o envio dos imóveis.
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {disponiveis.map(p => (
                  <li key={p.portal_key}>
                    <CartaoDeLink para={rotaDoPortal(p)}>
                      <span className="flex items-center gap-3">
                        <PortalLogo portalKey={p.portal_key} className="w-10 h-10" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-sidebar-foreground">{p.name}</span>
                          {p.integration_status === 'adapted' && (
                            <span className="block text-xs text-sidebar-foreground/70">Formato a confirmar</span>
                          )}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-primary">Conectar</span>
                    </CartaoDeLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Pagina>
  );
}
