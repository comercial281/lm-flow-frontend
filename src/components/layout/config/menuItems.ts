import { LucideIcon } from 'lucide-react';
import {
  User,
  LogOut,
  Cog,
  MessageSquare,
  Contact,
  SquareKanban,
  Bot,
  Layers,
  PieChart,
  Users2,
  Clock,
  Code,
  MessageCircle,
  Key,
  Tags,
  TestTube,
  Wand,
  Settings,
  List,
  GraduationCap,
  Shield,
  Zap,
  Store,
  Building2,
  CalendarClock,
  FileSignature,
  ClipboardList,
  Globe,
  FileText,
  TrendingUp,
} from 'lucide-react';

export interface MenuItem {
  id?: string;
  name: string;
  href: string;
  icon: LucideIcon;
  subItems?: SubMenuItem[];
  resource?: string;
  action?: string;
  permissions?: string[];
  requireAll?: boolean;
  requiredRoleKey?: string;
  requiredEmail?: string | string[];
}

export interface SubMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  resource?: string;
  action?: string;
  permissions?: string[];
  requireAll?: boolean;
  requiredRoleKey?: string;
  requiredEmail?: string | string[];
}

export interface ProfileMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export const getCustomerMenuItems = (t: (key: string) => string): MenuItem[] => [
  {
    name: t('menu.customer.dashboard'),
    href: '/dashboard',
    icon: PieChart,
    resource: 'dashboard',
    action: 'read',
  },
  {
    name: t('menu.customer.conversations'),
    href: '/conversations',
    icon: MessageSquare,
    resource: 'conversations',
    action: 'read',
  },
  {
    id: 'customer-contacts',
    name: t('menu.customer.contacts'),
    href: '/contacts',
    icon: Contact,
    resource: 'contacts',
    action: 'read',
    subItems: [
      {
        name: t('menu.contacts.list'),
        href: '/contacts',
        icon: Contact,
        resource: 'contacts',
        action: 'read',
      },
      {
        name: t('menu.contacts.scheduledActions'),
        href: '/contacts/scheduled-actions',
        icon: Clock,
        resource: 'contacts',
        action: 'read',
      },
    ],
  },
  {
    name: t('menu.customer.pipelines'),
    href: '/pipelines',
    icon: SquareKanban,
    resource: 'pipelines',
    action: 'read',
  },
  {
    name: 'Imóveis',
    href: '/properties',
    icon: Building2,
  },
  {
    name: 'Agenda de Visitas',
    href: '/visits',
    icon: CalendarClock,
  },
  {
    name: 'Propostas',
    href: '/proposals',
    icon: FileSignature,
  },
  {
    name: 'Captação',
    href: '/property-capture-requests',
    icon: ClipboardList,
  },
  {
    name: 'Interesses',
    href: '/property-interests',
    icon: TrendingUp,
  },
  {
    id: 'customer-agents',
    name: t('menu.customer.agents'),
    href: '/agents/list',
    icon: Bot,
    resource: 'ai_agents',
    action: 'read',
    subItems: [
      {
        name: t('menu.agents.list'),
        href: '/agents/list',
        icon: List,
        resource: 'ai_agents',
        action: 'read',
      },
      {
        name: t('menu.agents.customTools'),
        href: '/agents/custom-tools',
        icon: Wand,
        resource: 'ai_custom_tools',
        action: 'read',
      },
      {
        name: t('menu.agents.customMcps'),
        href: '/agents/custom-mcp-servers',
        icon: TestTube,
        resource: 'ai_custom_mcp_servers',
        action: 'read',
      },
    ],
  },
  {
    name: t('menu.customer.channels'),
    href: '/channels',
    icon: Layers,
    resource: 'channels',
    action: 'read',
  },
  {
    name: 'Marketplace',
    href: '/marketplace',
    icon: Store,
    resource: 'integrations',
    action: 'read',
  },
  {
    name: 'Clientes CRM',
    href: '/super-admin/clients',
    icon: Building2,
    requiredEmail: 'comercial@lealmidia.com.br',
  },
  {
    name: t('menu.customer.tutorials'),
    href: '/tutorials',
    icon: GraduationCap,
  },
  {
    id: 'customer-settings',
    name: t('menu.customer.settings'),
    href: '#',
    icon: Cog,
    subItems: [
      {
        name: t('menu.settings.account'),
        href: '/settings/account',
        icon: User,
        // Configurações de conta são sempre disponíveis - sem permissão específica
      },
      {
        name: t('menu.settings.users'),
        href: '/settings/users',
        icon: Users2,
        resource: 'users',
        action: 'read',
      },
      {
        name: t('menu.settings.teams'),
        href: '/settings/teams',
        icon: Clock,
        resource: 'teams',
        action: 'read',
      },
      {
        name: 'Cargos e Permissões',
        href: '/settings/roles',
        icon: Shield,
        resource: 'users',
        action: 'read',
      },
      {
        name: t('menu.settings.labels'),
        href: '/settings/labels',
        icon: Tags,
        resource: 'labels',
        action: 'read',
      },
      {
        name: t('menu.settings.customAttributes'),
        href: '/settings/attributes',
        icon: Code,
        resource: 'custom_attribute_definitions',
        action: 'read',
      },
      {
        name: t('menu.settings.cannedResponses'),
        href: '/settings/canned-responses',
        icon: MessageCircle,
        resource: 'canned_responses',
        action: 'read',
      },
      {
        name: 'Respostas Rápidas',
        href: '/settings/quick-replies',
        icon: Zap,
      },
      {
        name: 'Automações Boas-Vindas',
        href: '/settings/welcome-automations',
        icon: Zap,
      },
      {
        name: 'Automações de Lead',
        href: '/settings/lead-automations',
        icon: Zap,
      },
      {
        name: 'Follow-ups',
        href: '/settings/follow-ups',
        icon: Zap,
      },
      {
        name: 'Produtos',
        href: '/settings/products',
        icon: Store,
      },
      {
        name: 'Site Builder',
        href: '/settings/site-builder',
        icon: Globe,
      },
      {
        name: 'Formulários',
        href: '/settings/dynamic-forms',
        icon: FileText,
      },
      {
        name: t('menu.settings.macros'),
        href: '/settings/macros',
        icon: Settings,
        resource: 'macros',
        action: 'read',
      },
      {
        name: t('menu.settings.integrations'),
        href: '/settings/integrations',
        icon: Settings,
        resource: 'integrations',
        action: 'read',
      },
      {
        name: t('menu.settings.accessTokens'),
        href: '/settings/access-tokens',
        icon: Key,
        resource: 'access_tokens',
        action: 'read',
      },
      {
        name: t('menu.settings.admin'),
        href: '/settings/admin',
        icon: Shield,
        resource: 'installation_configs',
        action: 'manage',
      },
    ],
  },
];

export const getProfileMenuItems = (
  t: (key: string) => string,
  navigate: (path: string) => void,
  setLogoutDialogOpen: (open: boolean) => void,
): ProfileMenuItem[] => {
  return [
    {
      name: t('profile.myProfile'),
      href: '/profile',
      icon: User,
      onClick: () => navigate('/profile'),
    },
    {
      name: t('profile.logout'),
      href: '#',
      icon: LogOut,
      onClick: () => setLogoutDialogOpen(true),
    },
  ];
};

// Função utilitária para verificar se um item de menu deve ser exibido
export const shouldShowMenuItem = (
  item: MenuItem | SubMenuItem,
  canFunction: (resource: string, action: string) => boolean,
  canAnyFunction: (permissions: string[]) => boolean,
  canAllFunction: (permissions: string[]) => boolean,
  userRoleKey?: string,
  userEmail?: string
): boolean => {
  // Gate por email (espelha checagens server-side hardcoded por email, ex: super-admin)
  if (item.requiredEmail) {
    if (!userEmail) return false;
    const allowed = Array.isArray(item.requiredEmail) ? item.requiredEmail : [item.requiredEmail];
    if (!allowed.includes(userEmail)) return false;
  }

  // Verificar role obrigatória
  if (item.requiredRoleKey) {
    return userRoleKey === item.requiredRoleKey;
  }

  // Verificar permissões específicas
  if (item.permissions && item.permissions.length > 0) {
    return item.requireAll
      ? canAllFunction(item.permissions)
      : canAnyFunction(item.permissions);
  }

  // Verificar permissão resource.action
  if (item.resource && item.action) {
    return canFunction(item.resource, item.action);
  }

  // Se não há permissões específicas, permitir acesso para usuários autenticados
  return true;
};

// Função para filtrar menus baseado em permissões
export const filterMenuItemsByPermissions = (
  items: MenuItem[],
  canFunction: (resource: string, action: string) => boolean,
  canAnyFunction: (permissions: string[]) => boolean,
  canAllFunction: (permissions: string[]) => boolean,
  userRoleKey?: string,
  userEmail?: string
): MenuItem[] => {
  return items
    .filter(item => shouldShowMenuItem(item, canFunction, canAnyFunction, canAllFunction, userRoleKey, userEmail))
    .map(item => {
      // Se o item tem subitens, filtrar os subitens também
      if (item.subItems && item.subItems.length > 0) {
        const filteredSubItems = item.subItems.filter(subItem =>
          shouldShowMenuItem(subItem, canFunction, canAnyFunction, canAllFunction, userRoleKey, userEmail)
        );

        // Se não há subitens visíveis, não mostrar o item pai
        if (filteredSubItems.length === 0) {
          return null;
        }

        return {
          ...item,
          subItems: filteredSubItems
        };
      }

      return item;
    })
    .filter((item): item is MenuItem => item !== null);
};
