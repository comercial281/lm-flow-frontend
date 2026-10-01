import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { destinoDaAbaAntiga } from './adminEnderecosAntigos';

/** Redireciona mantendo a busca (`?client=...`) e o `#`. */
export function RedirecionaComBusca({ para }: { para: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${para}${search}${hash}`} replace />;
}

/** Tela-base que aceitava `?tab=`: leva o link antigo pra aba nova. */
export function ComAbaAntiga({ base, children }: { base: '/admin/clientes' | '/admin/agentes'; children: ReactNode }) {
  const [busca] = useSearchParams();
  const destino = destinoDaAbaAntiga(base, busca.get('tab'));
  if (destino) return <Navigate to={destino} replace />;
  return <>{children}</>;
}
