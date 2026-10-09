import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users2, Shield, Users, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ds';
import { BaseHeader, Pagina } from '@/components/base';
import PeopleTab from './PeopleTab';
import RoleCards from './roles/RoleCards';
import PermissionsMatrix from './roles/PermissionsMatrix';
import { useConfirmacao } from '@/hooks/useConfirmacao';
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
  { key: 'times', label: 'Times', icon: Users },
  { key: 'cargos', label: 'Cargos', icon: Shield },
  { key: 'permissoes', label: 'Permissões', icon: SlidersHorizontal },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function TeamAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo<TabKey>(() => {
    const requested = searchParams.get('aba');
    return TABS.some(t => t.key === requested) ? (requested as TabKey) : 'pessoas';
  }, [searchParams]);

  // A aba Permissões avisa quando há mudança sem salvar; trocar de aba desmonta o
  // quadro e perderia o rascunho, então pede confirmação antes.
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((v: boolean) => setDirty(v), []);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const handleTabChange = async (value: string) => {
    if (dirty && value !== activeTab) {
      const ok = await confirmar({
        titulo: 'Descartar alterações?',
        descricao: 'Você mudou permissões e ainda não salvou. Se sair agora, essas mudanças se perdem.',
        rotuloDaAcao: 'Descartar',
        destrutivo: true,
      });
      if (!ok) return;
    }
    // replace: trocar de aba não é navegação, e empilhar histórico faria o botão
    // Voltar do navegador percorrer abas em vez de sair da tela.
    setSearchParams(value === 'pessoas' ? {} : { aba: value }, { replace: true });
  };

  return (
    <Pagina cabecalho={<BaseHeader title="Equipe" subtitle="Quem atende, por qual número e em qual time" />}>
      <Tabs value={activeTab} onValueChange={v => void handleTabChange(v)} className="space-y-6">
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
          {/* Cartões dos cargos. A lista completa antiga segue em /equipe/cargos/lista. */}
          <RoleCards />
        </TabsContent>
        <TabsContent value="permissoes">
          <PermissionsMatrix onDirtyChange={onDirtyChange} />
        </TabsContent>
        <TabsContent value="times">
          <Teams embutido />
        </TabsContent>
      </Tabs>
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
