import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Zap, Rocket, Radio, Repeat, Bell, Shuffle } from 'lucide-react';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { isRootTenantHost } from '@/components/layout/config/menuItems';
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
  const location = useLocation();

  // Espelha a mesma regra de visibilidade do menu lateral (shouldShowMenuItem).
  const visible = SECTORS.filter(s => {
    if (s.hideOnRoot && isRootTenantHost()) return false;
    // Super-admin (Leal Mídia) NUNCA perde um setor — vê e opera tudo, mesmo o
    // que está OFF pro cliente. O cliente segue os toggles normalmente.
    if (s.featureKey && features[s.featureKey] === false && !isSuper) return false;
    if (s.clientToggleKey && !isSuper && features[s.clientToggleKey] !== true) return false;
    return true;
  });

  // /automations sem setor → manda pro primeiro setor visível.
  if (location.pathname === '/automations' || location.pathname === '/automations/') {
    if (visible.length === 0) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Nenhuma automação disponível neste plano.
        </div>
      );
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
        <div className="flex items-center gap-1 overflow-x-auto">
          {visible.map(({ key, path, name, icon: Icon }) => (
            <NavLink
              key={key}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {name}
            </NavLink>
          ))}
        </div>
      </div>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
