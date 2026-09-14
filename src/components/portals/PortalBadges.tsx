import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Portal, PortalAdType } from '@/services/portals/portalsService';

/**
 * Selo do formato do feed: *validado* (conferido no testador do portal) ou
 * *adaptado* (formato mais provável, a confirmar com o portal antes do primeiro
 * envio). A nota do servidor vai no `title` e, onde há espaço, numa linha abaixo.
 * Servidor antigo não manda o status: sem selo.
 */
export function PortalStatusBadge({ portal }: { portal: Pick<Portal, 'integration_status' | 'status_note'> }) {
  if (portal.integration_status === 'validated') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        title={portal.status_note ?? undefined}
      >
        <CheckCircle2 className="h-3 w-3" />
        Formato validado
      </span>
    );
  }
  if (portal.integration_status === 'adapted') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        title={portal.status_note ?? 'Formato adaptado — confirme com o portal antes do primeiro envio'}
      >
        <AlertTriangle className="h-3 w-3" />
        Formato adaptado
      </span>
    );
  }
  return null;
}

/**
 * Contadores compactos por tipo ("Padrão 350/456 · Destaque 40/40"), com o
 * tipo estourado em vermelho. Lê o `count` e o `limit` que o servidor mandou.
 */
export function PortalTypeCounters({ adTypes, className = '' }: { adTypes: PortalAdType[]; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`}>
      {adTypes.map((t, i) => {
        const estourou = t.limit !== null && t.limit !== undefined && t.count > t.limit;
        return (
          <span key={t.key} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/60">·</span>}
            <span
              className={estourou ? 'text-destructive font-semibold' : undefined}
              title={estourou ? 'Acima da cota do plano' : undefined}
            >
              {t.label}{' '}
              {t.limit === null || t.limit === undefined ? t.count : `${t.count}/${t.limit}`}
            </span>
          </span>
        );
      })}
    </span>
  );
}
