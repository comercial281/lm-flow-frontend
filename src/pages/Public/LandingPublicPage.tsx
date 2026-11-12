import { useParams } from 'react-router-dom';
import { LandingPublicView } from '@/features/landing/public/LandingPublicView';
import { NoEnderecoDoCliente } from '@/features/landing/public/NoEnderecoDoCliente';

/**
 * Rota antiga da landing dentro do app do CRM (/lp/:tenant/:slug).
 *
 * Em produção quem serve /lp/* é o `lp.html` — a entrada enxuta, sem o CRM
 * (ver vercel.json e src/lp/main.tsx). Esta rota fica como rede: quem chegar
 * aqui por navegação interna do app vê a MESMA página, montada pela mesma view.
 */
export default function LandingPublicPage() {
  const { tenant = '', slug = '' } = useParams<{ tenant: string; slug: string }>();
  return (
    <NoEnderecoDoCliente tenant={tenant}>
      <LandingPublicView tenant={tenant} slug={slug} />
    </NoEnderecoDoCliente>
  );
}
