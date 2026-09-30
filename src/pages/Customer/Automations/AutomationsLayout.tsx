import { useEffect, useRef } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Zap, Rocket, Radio, Repeat, Bell, Shuffle, GitBranch } from 'lucide-react';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useCan } from '@/hooks/useCan';
import { isRootTenantHost, AUTOMATION_SECTOR_PERMISSIONS } from '@/components/layout/config/menuItems';
import NoAccessState from '@/components/permissions/NoAccessState';
import Abas from '@/components/base/Abas';
import type { LucideIcon } from 'lucide-react';

interface Sector {
  key: string;
  name: string;
  path: string;
  icon: LucideIcon;
  /** Se a feature do tenant estiver explicitamente false, some. Ausência = ON. */
  featureKey?: string;
  /** Acesso gerenciado pela Leal Mídia: super-admin sempre vê; cliente só se === true. */
  clientToggleKey?: string;
  // Some no painel MASTER (app.lmflow, host raiz): telas que so fazem sentido no CRM do cliente.
  hideOnRoot?: boolean;
}

// Cada "setor" da aba Automações. Mesmas páginas que antes viviam soltas em
// Configurações, agora agrupadas num único lugar.
const SECTORS: Sector[] = [
  {
    key: 'lead-automations',
    name: 'Regras de Lead',
    path: '/automations/lead-automations',
    icon: Zap,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  {
    key: 'message-funnels',
    name: 'Editor de Funis',
    path: '/automations/message-funnels',
    icon: Rocket,
    featureKey: 'message_funnels',
  },
  // FlowBuilder: editor visual de automação (canvas de blocos), irmão de
  // "Regras de Lead" — reusa o mesmo feature flag por não ter registro
  // próprio ainda (ver TODO no plano de porte do Hub).
  {
    key: 'flow-builder',
    name: 'FlowBuilder',
    path: '/automations/flow-builder',
    icon: GitBranch,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  // Substitui "Formulários (Meta)": além dos formulários, junta a conexão da
  // Página do Facebook (antes solta em Configurações → Integrações).
  {
    key: 'origem',
    name: 'Origem',
    path: '/automations/origem',
    hideOnRoot: true,
    icon: Radio,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  // "Follow-ups", "Follow-up automático" e "Robô Sem Resposta" eram três setores;
  // viraram um só. As outras duas viram seção dentro da própria tela do funil.
  {
    key: 'follow-ups',
    name: 'Follow-up',
    path: '/automations/follow-ups',
    icon: Repeat,
    featureKey: 'follow_ups',
  },
  {
    key: 'whatsapp-reminders',
    name: 'Lembretes',
    path: '/automations/whatsapp-reminders',
    icon: Bell,
  },
  // Tela única de distribuição: modo (Rodízio/Leilão/Manual/Por disponibilidade)
  // + quem participa + prazo + gestor. Antes eram 2 itens aqui ("Roleta de
  // Corretores" e "Distribuição de Leads") pro mesmo conceito, com 2 motores.
  {
    key: 'roleta-config',
    name: 'Distribuição de Leads',
    path: '/automations/roleta-config',
    icon: Shuffle,
    featureKey: 'lead_automations',
  },
];

export default function AutomationsLayout() {
  const { features } = useTenantFeatures();
  const isSuper = useIsSuperAdmin();
  const pode = useCan();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // O <main> é o mesmo elemento DOM entre trocas de aba (só o Outlet muda) — se
  // uma aba tiver conteúdo mais largo, o scroll horizontal fica na posição
  // antiga ao entrar numa aba mais estreita, e o conteúdo novo parece "sumido"
  // fora da viewport. Zera o scroll a cada troca de rota.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  // Espelha a mesma regra de visibilidade do menu lateral (shouldShowMenuItem).
  const visibleByPlan = SECTORS.filter(s => {
    if (s.hideOnRoot && isRootTenantHost()) return false;
    // Super-admin (Leal Mídia) NUNCA perde um setor — vê e opera tudo, mesmo o
    // que está OFF pro cliente. O cliente segue os toggles normalmente.
    if (s.featureKey && features[s.featureKey] === false && !isSuper) return false;
    if (s.clientToggleKey && !isSuper && features[s.clientToggleKey] !== true) return false;
    return true;
  });

  // Mesmo gate do menu: o setor que o cargo não lê some da barra.
  const visible = visibleByPlan.filter(s => {
    const perm = AUTOMATION_SECTOR_PERMISSIONS[s.key];
    if (perm) {
      const [resource, action] = perm.split('.');
      if (!pode(resource, action)) return false;
    }
    return true;
  });

  // /automations sem setor → manda pro primeiro setor visível.
  if (location.pathname === '/automations' || location.pathname === '/automations/') {
    if (visibleByPlan.length === 0) {
      // Nenhum setor sobrevive nem antes do cargo — é o plano/feature do
      // cliente que não tem automação nenhuma, não o cargo da pessoa.
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Nenhuma automação disponível neste plano.
        </div>
      );
    }
    if (visible.length === 0) {
      // Havia setor pelo plano, mas o cargo não lê nenhum deles — é o aviso do
      // cargo, não a mensagem de plano.
      return <NoAccessState />;
    }
    return <Navigate to={visible[0].path} replace />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Automações</h1>
        </div>
        {/* Abas da casa (Fase 3): mesmo desenho de antes, e trocar de setor com
            alteração não salva pergunta antes. */}
        <Abas
          rotulo="Setores de Automações"
          abas={visible.map(({ key, name, icon, path }) => ({ chave: key, rotulo: name, icone: icon, para: path }))}
        />
      </div>
      <main ref={mainRef} className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
