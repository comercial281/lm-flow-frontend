import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users2, Shield, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ds';
import PeopleTab from './PeopleTab';
import RolesPage from '@/pages/Customer/Settings/Roles';
import Teams from '@/pages/Customer/Settings/Teams/Teams';

/* "Equipe" — a tela única de pessoas, cargos e times.
 *
 * Antes isso vivia em quatro endereços que ninguém conseguia relacionar: Equipe
 * (cargo + instâncias), Configurações → Usuários (cadastro), Configurações →
 * Cargos e Permissões (o que cada cargo pode) e Configurações → Times. Cada tela
 * era dona de um pedaço da mesma decisão e nenhuma era dona da decisão inteira,
 * então cadastrar alguém exigia passar pelas quatro na ordem certa — e a ordem
 * certa não estava escrita em lugar nenhum.
 *
 * Mesmo remédio já aplicado no follow-up e na IA: UMA tela manda, o resto vira
 * aba aqui dentro e as rotas antigas redirecionam (ver as rotas). Se aparecer
 * uma quinta tela sobre gente, ela entra como aba — não como endereço novo.
 *
 * A aba vem da URL (?aba=cargos) de propósito: é o que faz o redirect das rotas
 * antigas cair na aba certa em vez de largar a pessoa na primeira. */

const TABS = [
  { key: 'pessoas', label: 'Pessoas', icon: Users2 },
  { key: 'cargos', label: 'Cargos e Permissões', icon: Shield },
  { key: 'times', label: 'Times', icon: Users },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function TeamAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo<TabKey>(() => {
    const requested = searchParams.get('aba');
    return TABS.some(t => t.key === requested) ? (requested as TabKey) : 'pessoas';
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    // replace: trocar de aba não é navegação, e empilhar histórico faria o botão
    // Voltar do navegador percorrer abas em vez de sair da tela.
    setSearchParams(value === 'pessoas' ? {} : { aba: value }, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex items-start gap-3">
        <div
          className="w-1 h-9 rounded-full shrink-0"
          style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Equipe</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quem é quem, o que cada cargo pode fazer e por onde cada um atende
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap justify-start gap-1 bg-transparent p-0 h-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                <Icon className="h-4 w-4" /> {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="pessoas">
          <PeopleTab />
        </TabsContent>
        <TabsContent value="cargos">
          {/* embedded: a aba já tem o título "Equipe" acima, e a tela de cargos
              traz o próprio <h1> quando aberta sozinha. */}
          <RolesPage embedded />
        </TabsContent>
        <TabsContent value="times">
          <Teams />
        </TabsContent>
      </Tabs>
    </div>
  );
}
