import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Zap, Rocket, Code, FileInput, Repeat, Bell, Shuffle, SlidersHorizontal, Bot, Target } from 'lucide-react';
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
    key: 'message-funnels',
    name: 'Funis de Mensagem',
    path: '/automations/message-funnels',
    icon: Rocket,
    featureKey: 'message_funnels',
  },
  {
    key: 'template-variables',
    name: 'Variáveis de Funis',
    path: '/automations/template-variables',
    icon: Code,
    featureKey: 'message_funnels',
  },
  {
    key: 'sales-agents',
    name: 'IA Vendedora',
    path: '/automations/sales-agents',
    icon: Bot,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  {
    key: 'lead-automations',
    name: 'Automações de Lead',
    path: '/automations/lead-automations',
    icon: Zap,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  {
    key: 'lead-ads-forms',
    name: 'Formulários (Meta)',
    path: '/automations/lead-ads-forms',
    hideOnRoot: true,
    icon: FileInput,
    featureKey: 'lead_automations',
    clientToggleKey: 'client_manage_automations',
  },
  {
    key: 'follow-ups',
    name: 'Follow-ups',
    path: '/automations/follow-ups',
    icon: Repeat,
    featureKey: 'follow_ups',
  },
  {
    key: 'follow-up-auto',
    name: 'Follow-up automático',
    path: '/automations/follow-up-auto',
    icon: Repeat,
    featureKey: 'follow_ups',
  },
  {
    key: 'whatsapp-reminders',
    name: 'Lembretes',
    path: '/automations/whatsapp-reminders',
    icon: Bell,
  },
  {
    key: 'roleta-config',
    name: 'Roleta de Corretores',
    path: '/automations/roleta-config',
    icon: Shuffle,
    featureKey: 'lead_automations',
  },
  {
    key: 'assignment-settings',
    name: 'Distribuição de Leads',
    path: '/automations/assignment-settings',
    icon: SlidersHorizontal,
    featureKey: 'lead_automations',
  },
  {
    key: 'pixel-capi',
    name: 'Pixel / CAPI',
    path: '/automations/pixel-capi',
    icon: Target,
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
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-sidebar-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Automações
          </h3>
        </div>
        <nav className="space-y-1">
          {visible.map(({ key, path, name, icon: Icon }) => (
            <NavLink
              key={key}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
