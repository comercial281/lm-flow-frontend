// O assistente de 6 etapas saiu na entrega 2: o passo a passo do Configurar é o
// mesmo pra criar e pra editar. Link salvo, favorito ou e-mail antigo cai na página
// Identidade da mesma IA. Sem PermissionRoute: quem confere o cargo é o /ia-vendedora.
import { Navigate, useParams } from 'react-router-dom';
import { paramsDaIa } from '@/features/salesAgents/iaMenu';

export default function RedirecionaAssistente() {
  const { id } = useParams();
  const busca = new URLSearchParams(paramsDaIa(id ?? null, 'configurar', 'identidade')).toString();
  return <Navigate to={`/ia-vendedora?${busca}`} replace />;
}
