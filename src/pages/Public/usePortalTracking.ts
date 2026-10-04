// src/pages/Public/usePortalTracking.ts
// Liga rastreamento e contador numa página do site público. Uma linha por página.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { SiteInfo } from './portalShared';
import { installSiteTracking, trackPageView } from '@/features/siteBuilder/public/siteTracking';
import { sendSiteVisit, type VisitInput } from '@/features/siteBuilder/public/siteVisits';

const API = import.meta.env.VITE_API_URL as string;

export function usePortalTracking(site: SiteInfo | null | undefined, tenant: string | undefined, visit: VisitInput | null): void {
  const { pathname } = useLocation();
  // Pixel/GA4: uma visualização por página (pathname), nunca por troca de filtro.
  useEffect(() => {
    if (!site || !tenant) return;
    installSiteTracking(site);
    trackPageView(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!site, tenant, pathname]);

  // Contador próprio: uma visita por página. `visit` nulo = ainda não é hora (a busca espera a URL assentar).
  useEffect(() => {
    if (!site || !tenant || !visit) return;
    sendSiteVisit(visit, { api: API, tenant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!site, tenant, pathname, !!visit, visit?.kind, visit?.propertyCode, visit?.pageSlug]);
}
