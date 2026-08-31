// Guarda das rotas da Área de Membros (/academia).
//
// Diferente do resto do app, aqui "não está logado" tem DOIS significados:
//
//   - num endereço de cliente (fulano.lmflow.com.br): a pessoa tem conta ali e
//     só precisa entrar — segue o caminho normal, o login com o destino
//     preservado;
//   - num endereço que não é de cliente nenhum (o app da Leal Mídia, o apex):
//     não existe conta ali. Mandar essa pessoa para o login é o que produzia o
//     "erro ao entrar na conta" de quem clicava no link da aula vindo do
//     WhatsApp. Aqui ela vê a porta de entrada, diz o e-mail e é encaminhada
//     para a MESMA aula dentro do app da imobiliária dela.
//
// Quem decide qual é o caso é o próprio endereço aberto (getSubdomainSlug
// devolve null no apex e nos subdomínios reservados, `app` incluído), então
// isto vale para qualquer link já enviado, sem depender de configuração.

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSubdomainSlug } from '@/services/core/tenant';
import AcademyEntry from '@/pages/Customer/Academia/AcademyEntry';

const AcademiaRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) return <>{children}</>;

  if (getSubdomainSlug() === null) return <AcademyEntry />;

  const destino = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?returnUrl=${encodeURIComponent(destino)}`} replace />;
};

export default AcademiaRoute;
