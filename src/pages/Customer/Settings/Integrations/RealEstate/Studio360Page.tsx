import { Building2 } from 'lucide-react';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

export default function Studio360Page() {
  return (
    <RealEstateIntegrationPage
      integrationType="studio360"
      displayName="Studio360"
      description="Plataforma de gestão para construtoras e imobiliárias. Sincronize imóveis, unidades e clientes com o CRM."
      logo="🏗️"
      icon={Building2}
      configFields={[
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'sua-api-key-studio360',
          hint: 'Chave de API do Studio360. Encontre em Configurações → Integrações.',
        },
        {
          key: 'account_id',
          label: 'ID da Conta',
          placeholder: '12345',
          hint: 'Identificador da sua conta no Studio360.',
        },
      ]}
    />
  );
}
