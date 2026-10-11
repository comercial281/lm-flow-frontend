import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return <LoadingScreen fullScreen />;
  }

  // Redirecionar para login se não estiver autenticado, preservando o destino.
  // O `state.from` sozinho não bastava: quem lê o destino depois do login é o
  // `returnUrl` da query (Auth.tsx, inclusive no fluxo de MFA), e ninguém o
  // alimentava. Na prática o corretor clicava no link de aceite que recebe no
  // WhatsApp, logava e caía no dashboard, com o prazo do lead correndo.
  if (!isAuthenticated) {
    const destino = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(destino)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
