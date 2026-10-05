// src/features/siteBuilder/public/useTenantDoSite.ts
// De qual cliente é o site aberto, e como montar os links dele.
//
// No endereço lmflow o cliente vem da rota (`/portal/:tenant/...`,
// `/imovel/:tenant/:code`). No domínio do cliente as rotas são limpas e o
// cliente vem do domínio: o roteador do domínio (src/routes/SiteDoDominio.tsx)
// põe o site confirmado neste contexto. Fora dele, o contexto é null.
import { createContext, useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { CtxDoSite, SiteDoDominio } from './dominioDoSite';

export const SiteDoDominioContext = createContext<SiteDoDominio | null>(null);

/** O cliente do site: o do domínio, ou o da rota no endereço lmflow. */
export function useTenantDoSite(): string | undefined {
  const site = useContext(SiteDoDominioContext);
  const { tenant } = useParams<{ tenant: string }>();
  return site?.tenant ?? tenant;
}

/** O que `caminhoDoSite` precisa: o cliente e se o site está no domínio dele. */
export function useCtxDoSite(tenant: string): CtxDoSite {
  const site = useContext(SiteDoDominioContext);
  return useMemo(() => ({ tenant: site?.tenant ?? tenant, dominio: !!site }), [site, tenant]);
}
