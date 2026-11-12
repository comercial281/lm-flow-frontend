import { useParams } from 'react-router-dom';
import { LandingResultView } from '@/features/landing/public/LandingResultView';
import { NoEnderecoDoCliente } from '@/features/landing/public/NoEnderecoDoCliente';

/**
 * Rota antiga da página de resultado da landing dentro do app do CRM
 * (/lp/:tenant/:slug/obrigado | /desqualificado). Em produção quem serve /lp/*
 * é o `lp.html` (ver LandingPublicPage); esta rota é a rede para navegação
 * interna, e monta a mesma view.
 */
export default function LandingResultPage() {
  const { tenant = '', slug = '', result } = useParams<{ tenant: string; slug: string; result: string }>();
  return (
    <NoEnderecoDoCliente tenant={tenant}>
      <LandingResultView tenant={tenant} slug={slug} result={result} />
    </NoEnderecoDoCliente>
  );
}
