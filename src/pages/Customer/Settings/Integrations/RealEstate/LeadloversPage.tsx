import { Target } from 'lucide-react';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

export default function LeadloversPage() {
  return (
    <RealEstateIntegrationPage
      integrationType="leadlovers"
      displayName="Leadlovers"
      description="Envie leads capturados para funis de nutrição no Leadlovers. Automatize sequências de e-mail e SMS."
      logo="🎯"
      icon={Target}
      configFields={[
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'seu-token-leadlovers',
          hint: 'Token de acesso da API do Leadlovers. Encontre em Perfil → Ferramentas de Integração.',
        },
        {
          key: 'machine_id',
          label: 'ID da Máquina',
          placeholder: '12345',
          hint: 'ID da máquina (funil) onde os leads serão inseridos.',
        },
      ]}
    />
  );
}
