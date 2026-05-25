import { Radio } from 'lucide-react';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

export default function RdStationPage() {
  return (
    <RealEstateIntegrationPage
      integrationType="rd_station"
      displayName="RD Station Marketing"
      description="Envie leads do CRM para funis de nutrição no RD Station Marketing. Automatize sequências de e-mail e WhatsApp."
      logo="🔵"
      icon={Radio}
      configFields={[
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'seu-token-rdstation',
          hint: 'Gere em RD Station → Configurações → Integrações → API de Marketing.',
        },
        {
          key: 'funnel_name',
          label: 'Nome do Funil padrão',
          placeholder: 'default',
          hint: 'Nome do funil onde os leads serão inseridos. Deixe em branco para usar "default".',
        },
      ]}
    />
  );
}
