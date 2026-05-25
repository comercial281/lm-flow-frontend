import { Megaphone } from 'lucide-react';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

export default function MetaAdsPage() {
  return (
    <RealEstateIntegrationPage
      integrationType="meta_ads"
      displayName="Meta Ads"
      description="Captura leads diretamente dos formulários do Facebook e Instagram Ads. Cada lead vira um contato no CRM automaticamente."
      logo="📘"
      icon={Megaphone}
      configFields={[
        {
          key: 'page_id',
          label: 'Page ID (Facebook)',
          placeholder: '123456789012345',
          hint: 'ID numérico da sua página do Facebook. Encontre em Configurações da Página → Informações da Página.',
        },
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'EAAxxxxx...',
          hint: 'Token de acesso permanente gerado no Meta Business Manager para a sua página.',
        },
        {
          key: 'verify_token',
          label: 'Verify Token (webhook)',
          placeholder: 'chave_flow_meta',
          hint: 'Token de verificação do webhook. Use o mesmo valor no Meta Webhook → Verify Token.',
        },
      ]}
    />
  );
}
