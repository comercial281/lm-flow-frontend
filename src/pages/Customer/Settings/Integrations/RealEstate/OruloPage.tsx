import { Building } from 'lucide-react';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

export default function OruloPage() {
  return (
    <RealEstateIntegrationPage
      integrationType="orulo"
      displayName="Órulo"
      description="Portal de imóveis lançamentos. Sincronize empreendimentos e interesse de compradores diretamente no CRM."
      logo="🏢"
      icon={Building}
      configFields={[
        {
          key: 'client_id',
          label: 'Client ID',
          placeholder: 'seu-client-id-orulo',
          hint: 'Client ID fornecido pelo suporte do Órulo.',
        },
        {
          key: 'client_secret',
          label: 'Client Secret',
          type: 'password',
          placeholder: 'seu-client-secret',
          hint: 'Client Secret fornecido pelo suporte do Órulo.',
        },
      ]}
    />
  );
}
