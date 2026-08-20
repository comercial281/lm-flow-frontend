import { useState } from 'react';
import { Radio, Megaphone, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ds';
import LeadAdsForms from '@/pages/Customer/Settings/LeadAdsForms';
import RealEstateIntegrationPage from '@/components/integrations/providers/RealEstateIntegrationPage';

type OrigemTab = 'meta' | 'formularios';

// De onde entram leads no CRM. Hoje só Facebook/Instagram Ads (Meta) — conectar
// a página + mapear cada formulário pra um pipeline. Site como origem fica pra
// depois (não é prioridade agora).
export default function Origem() {
  const [tab, setTab] = useState<OrigemTab>('meta');

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-2">
        <Radio className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Origem</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        De onde vêm os leads que entram no CRM.
      </p>

      <Tabs value={tab} onValueChange={v => setTab(v as OrigemTab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="meta">
            <Megaphone className="h-4 w-4 mr-1.5" />
            Página do Facebook
          </TabsTrigger>
          <TabsTrigger value="formularios">Formulários</TabsTrigger>
          <TabsTrigger value="site" disabled>
            <Globe className="h-4 w-4 mr-1.5" />
            Site (em breve)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="flex-1 min-h-0">
          <RealEstateIntegrationPage
            integrationType="meta_ads"
            displayName="Meta Ads"
            description="Conecta a página do Facebook/Instagram pra captar os leads dos formulários de anúncio direto no CRM."
            logo="📘"
            icon={Megaphone}
            onBack={() => setTab('formularios')}
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
                placeholder: 'lm_flow_meta',
                hint: 'Token de verificação do webhook. Use o mesmo valor no Meta Webhook → Verify Token.',
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="formularios" className="flex-1 min-h-0">
          <LeadAdsForms />
        </TabsContent>
      </Tabs>
    </div>
  );
}
