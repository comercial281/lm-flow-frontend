import { useParams } from 'react-router-dom';
import { LandingResultView } from '@/features/landing/public/LandingResultView';

/**
 * Rota antiga da página de resultado da landing dentro do app do CRM
 * (/lp/:tenant/:slug/obrigado | /desqualificado). Em produção quem serve /lp/*
 * é o `lp.html` (ver LandingPublicPage); esta rota é a rede para navegação
 * interna, e monta a mesma view.
 */
export default function LandingResultPage() {
  const { tenant = '', slug = '', result } = useParams<{ tenant: string; slug: string; result: string }>();
  return <LandingResultView tenant={tenant} slug={slug} result={result} />;
}
