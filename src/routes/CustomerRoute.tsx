import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface CustomerRouteProps {
  children: ReactNode;
}

const CustomerRoute = ({ children }: CustomerRouteProps) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Se não está autenticado, redirecionar para login preservando o destino
  // (mesmo motivo do PrivateRoute: sem `returnUrl` o link de aceite morre no login).
  if (!isAuthenticated) {
    const destino = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(destino)}`} replace />;
  }

  // Permitir acesso se autenticado
  return <>{children}</>;
};

export default CustomerRoute;
