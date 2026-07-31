import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
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
