import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ds';
import { MessageFunnels } from '@/pages/Customer/Settings/MessageFunnels';
import { TemplateVariables } from '@/pages/Customer/Settings/TemplateVariables';
import CustomAttributes from '@/pages/Customer/Settings/CustomAttributes';

type EditorTab = 'funis' | 'variaveis' | 'atributos';

const TABS: { key: EditorTab; name: string }[] = [
  { key: 'funis', name: 'Funis de Mensagem' },
  { key: 'variaveis', name: 'Variáveis' },
  { key: 'atributos', name: 'Atributos Personalizados' },
];

// Junta Funis de Mensagem + Variáveis de Funis + Atributos Personalizados numa
// página só: as três telas eram separadas mas resolvem o mesmo problema (montar
// a mensagem que o funil dispara), então viraram abas de um único editor.
export default function EditorDeFunis() {
  const [tab, setTab] = useState<EditorTab>('funis');

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Editor de Funis</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Monte os funis de mensagem, os campos ({'{{token}}'}) que eles usam e os atributos customizados do CRM.
      </p>

      <Tabs value={tab} onValueChange={v => setTab(v as EditorTab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 w-fit">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key}>{t.name}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="funis" className="flex-1 min-h-0">
          <MessageFunnels />
        </TabsContent>
        <TabsContent value="variaveis" className="flex-1 min-h-0">
          <TemplateVariables />
        </TabsContent>
        <TabsContent value="atributos" className="flex-1 min-h-0">
          <CustomAttributes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
