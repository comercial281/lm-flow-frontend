import { useState } from 'react';
import { Radio, Megaphone, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ds';
import LeadAdsForms from '@/pages/Customer/Settings/LeadAdsForms';
import MetaPagesPanel from './MetaPagesPanel';

type OrigemTab = 'meta' | 'formularios';

// De onde entram leads no CRM. Hoje só Facebook/Instagram Ads (Meta) — conectar
// as páginas (podem ser várias por cliente) + mapear cada formulário pra um
// pipeline. Site como origem fica pra depois (não é prioridade agora).
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
            Páginas do Facebook
          </TabsTrigger>
          <TabsTrigger value="formularios">Formulários</TabsTrigger>
          <TabsTrigger value="site" disabled>
            <Globe className="h-4 w-4 mr-1.5" />
            Site (em breve)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="flex-1 min-h-0 overflow-y-auto">
          <MetaPagesPanel onGoToForms={() => setTab('formularios')} />
        </TabsContent>

        <TabsContent value="formularios" className="flex-1 min-h-0">
          <LeadAdsForms />
        </TabsContent>
      </Tabs>
    </div>
  );
}
