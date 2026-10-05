// src/pages/Public/usePortalTracking.ts
// Liga rastreamento e contador numa página do site público. Uma linha por página.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { SiteInfo } from './portalShared';
import { installSiteTracking, trackPageView, type SiteTrackingConfig } from '@/features/siteBuilder/public/siteTracking';
import { sendSiteVisit, type VisitInput } from '@/features/siteBuilder/public/siteVisits';
import { ehPrevia } from '@/features/siteBuilder/public/previa';

const API = import.meta.env.VITE_API_URL as string;

/**
 * O que o site pode instalar. Em manutenção só GA4 e Pixel (a ficha do imóvel
 * continua recebendo anúncio e precisa contar o Lead); GTM e Códigos avançados
 * nunca, mesmo que um servidor os mande. As páginas que viram a página Em
 * manutenção não chamam o rastreamento (passam `null`).
 */
export function rastreamentoDoSite(site: SiteInfo): SiteTrackingConfig {
  // Prévia não é visita: nada de GA4, Pixel, GTM nem códigos.
  if (ehPrevia(site)) return { preview: true };
  if (site.maintenance !== true) return site;
  return { tracking: { ga4: site.tracking?.ga4 ?? null, facebook_pixel: site.tracking?.facebook_pixel ?? null } };
}

export function usePortalTracking(site: SiteInfo | null | undefined, tenant: string | undefined, visit: VisitInput | null): void {
  const { pathname } = useLocation();
  // Pixel/GA4: uma visualização por página (pathname), nunca por troca de filtro.
  const previa = ehPrevia(site);
  useEffect(() => {
    if (!site || !tenant || previa) return;
    installSiteTracking(rastreamentoDoSite(site));
    trackPageView(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!site, tenant, pathname, previa]);

  // Contador próprio: uma visita por página. `visit` nulo = ainda não é hora (a busca espera a URL assentar).
  useEffect(() => {
    // A prévia (o dono conferindo antes de publicar) não conta visita.
    if (!site || !tenant || !visit || previa) return;
    sendSiteVisit(visit, { api: API, tenant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!site, tenant, pathname, !!visit, visit?.kind, visit?.propertyCode, visit?.pageSlug, previa]);
}
