import { LucideIcon } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '@/hooks/useIsSuperAdmin';
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
  Tags,
  GraduationCap,
  Zap,
  Store,
  Building2,
  CalendarClock,
  FileSignature,
  ClipboardList,
  Globe,
  FileText,
  TrendingUp,
  Rocket,
  Target,
  Megaphone,
  NotebookPen,
  MessageSquarePlus,
} from 'lucide-react';
import { openFeedbackDialog } from '@/components/feedback/openFeedback';

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
  /**
   * Chave do catálogo de tenant features (ver ClientInstance::FEATURE_CATALOG no backend master).
   * Quando definida, o item só aparece se features[key] !== false.
   * Ausência da key OU features sem essa key => item visível (ON por padrão).
   */
  featureKey?: string;
  /**
   * Gate de acesso do CLIENTE a uma feature gerenciada pela Leal Mídia.
   * Quando definida: super-admin (Leal Mídia) SEMPRE vê; o cliente só vê se
   * features[clientToggleKey] === true (default OFF — diferente do featureKey).
   */
  clientToggleKey?: string;
  /** Quando true, só aparece no tenant raiz (VITE_IS_ROOT_TENANT=true). */
  rootTenantOnly?: boolean;
  /**
   * Anotado em runtime (não configurar à mão): true quando o item está visível
   * pra ele (super-admin) mas OCULTO pro cliente pelo estado atual dos toggles.
   * O Sidebar usa isso pra mostrar o selo "oculto pro cliente" — só o super vê.
   */
  hiddenFromClient?: boolean;
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
  featureKey?: string;
  clientToggleKey?: string;
  rootTenantOnly?: boolean;
  hiddenFromClient?: boolean;
  /**
   * Atalho que leva pra uma seção com o próprio menu lateral (ex: Automações).
   * Fecha o painel de submenu ao navegar, senão os dois ficam abertos ao
   * mesmo tempo (2 menus empilhados).
   */
  closesSubmenu?: boolean;
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
    featureKey: 'dashboard',
  },
  {
    name: t('menu.customer.conversations'),
    href: '/conversations',
    icon: MessageSquare,
    resource: 'conversations',
    action: 'read',
    featureKey: 'conversations',
  },
  {
    id: 'customer-contacts',
    name: t('menu.customer.contacts'),
    href: '/contacts',
    icon: Contact,
    resource: 'contacts',
    action: 'read',
    featureKey: 'contacts',
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
    featureKey: 'pipelines',
  },
  {
    name: 'Disparos',
    href: '/disparos',
    icon: Megaphone,
    featureKey: 'disparos',
  },
  {
    // IA Vendedora (pré-atendimento). Promovida de sub-item de Automações para
    // item de topo do CRM (URL própria /ia-vendedora). Feature gerenciada pela
    // Leal Mídia: super-admin SEMPRE vê; cliente só se ligar o toggle.
    name: 'IA Vendedora',
    href: '/ia-vendedora',
    icon: Bot,
    clientToggleKey: 'client_manage_automations',
  },
  {
    // Espaço — Notion por tenant (docs/bases colaborativas). Feature gerenciada
    // pela Leal Mídia: super-admin SEMPRE vê; o cliente só vê se a Leal Mídia
    // ligar o toggle "espaco" nas Funções do CRM (default OFF, como clientToggleKey).
    name: 'Espaço',
    href: '/espaco',
    icon: NotebookPen,
    clientToggleKey: 'espaco',
  },
  {
    // Painel "Equipe & Acessos" — só admins (gate resource users/update).
    name: 'Equipe',
    href: '/equipe',
    icon: Users2,
    resource: 'users',
    action: 'update',
  },
  {
    name: 'Imóveis',
    href: '/properties',
    icon: Building2,
    featureKey: 'properties',
  },
  {
    // Books (PDF) salvos nos imóveis — visualizar e baixar
    name: 'Books',
    href: '/books',
    icon: FileText,
    featureKey: 'properties',
  },
  {
    // Portais imobiliários (ZAP, Imóvel Web…) — feed + leads
    name: 'Portais',
    href: '/settings/portals',
    icon: Globe,
    featureKey: 'properties',
  },
  {
    name: 'Agenda de Visitas',
    href: '/visits',
    icon: CalendarClock,
    featureKey: 'visits',
  },
  {
    name: 'Propostas',
    href: '/proposals',
    icon: FileSignature,
    featureKey: 'proposals',
  },
  {
    name: 'Contratos',
    href: '/contracts',
    icon: FileText,
    featureKey: 'contracts',
  },
  {
    name: 'Captação',
    href: '/property-capture-requests',
    icon: ClipboardList,
    featureKey: 'property_capture',
  },
  {
    name: 'Interesses',
    href: '/property-interests',
    icon: TrendingUp,
    featureKey: 'property_interests',
  },
  {
    name: t('menu.customer.channels'),
    href: '/channels',
    icon: Layers,
    resource: 'channels',
    action: 'read',
    featureKey: 'channels',
  },
  {
    name: 'Automações',
    href: '/automations',
    icon: Zap,
    // Feature gerenciada pela Leal Mídia: super-admin SEMPRE vê; o cliente só vê
    // se a Leal Mídia ligar "client_manage_automations" nas Funções do CRM.
    clientToggleKey: 'client_manage_automations',
  },
  {
    name: 'Marketplace',
    href: '/marketplace',
    icon: Store,
    resource: 'integrations',
    action: 'read',
    // Acesso da Leal Mídia: super-admin SEMPRE vê; cliente só se a Leal Mídia
    // ligar o toggle "marketplace" nas Funções dele (default OFF — ver
    // DEFAULT_OFF_FEATURES no backend). Não faz sentido cliente ver isso.
    clientToggleKey: 'marketplace',
  },
  // 'Clientes CRM' e 'Biblioteca de Automacoes' saíram daqui: agora moram na
  // Área do Admin (/admin), num shell próprio. O menu do CRM só tem coisa que o
  // cliente usa — era esse o ponto de separar. Entrada: AdminAreaButton, no Header.
  {
    name: t('menu.customer.tutorials'),
    href: '/tutorials',
    icon: GraduationCap,
    featureKey: 'tutorials',
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
        // A rota /settings/account é protegida por accounts.read (PermissionRoute).
        // Gate do menu tem que casar com a rota, senão o corretor vê o item,
        // clica e cai em "Acesso Negado" (/unauthorized).
        resource: 'accounts',
        action: 'read',
      },
      // Usuários, Times e Cargos e Permissões saíram daqui: viraram as abas da
      // tela *Equipe*, no menu de cima. Eram quatro endereços mandando em
      // pedaços da mesma decisão (quem é a pessoa, o que ela pode, por onde
      // atende) e nenhum mandando na decisão inteira. As rotas antigas
      // redirecionam para a aba certa — link salvo não morre.
      {
        name: t('menu.settings.labels'),
        href: '/settings/labels',
        icon: Tags,
        resource: 'labels',
        action: 'read',
      },
      {
        name: 'Automações',
        href: '/automations',
        icon: Zap,
        clientToggleKey: 'client_manage_automations',
        closesSubmenu: true,
      },
      {
        name: 'Funis de Mensagem',
        href: '/automations/message-funnels',
        icon: Rocket,
        featureKey: 'message_funnels',
        closesSubmenu: true,
      },
      {
        name: 'Pixel / CAPI',
        href: '/settings/pixel-capi',
        icon: Target,
        featureKey: 'lead_automations',
      },
      {
        name: 'Site Builder',
        href: '/settings/site-builder',
        icon: Globe,
        featureKey: 'site_builder',
      },
      // MACROS OCULTO — habilitar quando pronto
      // {
      //   name: t('menu.settings.macros'),
      //   href: '/settings/macros',
      //   icon: Settings,
      //   resource: 'macros',
      //   action: 'read',
      // },
      // INTEGRAÇÕES OCULTO DO MENU — rota continua viva (Meta Ads/Shopify/etc
      // ainda são acessadas via link direto, ex: dentro de Automações → Origem).
      // {
      //   name: t('menu.settings.integrations'),
      //   href: '/settings/integrations',
      //   icon: Settings,
      //   resource: 'integrations',
      //   action: 'read',
      // },
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
    // Entrada fixa para o diálogo de feedback. Necessária porque na aba de
    // Conversas o botão flutuante é escondido (cobria o botão de enviar).
    {
      name: t('profile.feedback'),
      href: '#',
      icon: MessageSquarePlus,
      onClick: () => openFeedbackDialog(),
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
/**
 * Detecta em RUNTIME se estamos no deploy raiz (app.lmflow.com.br / dev) e não
 * num subdomínio de cliente. Necessário porque UM único build (com
 * VITE_IS_ROOT_TENANT='true') serve TODOS os subdomínios *.lmflow.com.br via
 * wildcard — então o flag de build-time não distingue raiz de cliente, e os
 * menus de super-admin (rootTenantOnly) vazavam pra dentro do CRM do cliente.
 */
export function isRootTenantHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return true; // dev local
  if (h.endsWith('.vercel.app')) return true; // previews do projeto principal
  // raiz = app.lmflow.com.br (ou apex). Cliente = renato/mybroker/...lmflow.com.br
  return h === 'app.lmflow.com.br' || h === 'lmflow.com.br';
}

// Super-admin Leal Mídia: a conta comercial@ (fantasma em todo tenant). Precisa
// enxergar e operar todas as funções, mesmo as OFF pro cliente.
export function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// Um item aparece pra ele (super) mas está OCULTO pro cliente quando:
//  - featureKey está explicitamente false (cliente não veria), ou
//  - clientToggleKey não está true (default OFF — só a Leal Mídia liga).
function isHiddenFromClient(
  item: MenuItem | SubMenuItem,
  features?: Record<string, boolean>
): boolean {
  if (item.featureKey && features?.[item.featureKey] === false) return true;
  if (item.clientToggleKey && features?.[item.clientToggleKey] !== true) return true;
  return false;
}

export const shouldShowMenuItem = (
  item: MenuItem | SubMenuItem,
  canFunction: (resource: string, action: string) => boolean,
  canAnyFunction: (permissions: string[]) => boolean,
  canAllFunction: (permissions: string[]) => boolean,
  userRoleKey?: string,
  userEmail?: string,
  features?: Record<string, boolean>,
  archivedKeys?: string[]
): boolean => {
  const isSuper = isSuperAdminEmail(userEmail);

  // Menu arquivado GLOBALMENTE (painel Clientes > Arquivados) some pra TODO
  // MUNDO, sem exceção pro super-admin — ao contrário dos gates abaixo, que o
  // super-admin sempre atravessa. É pra telas em desenvolvimento saírem do ar
  // por completo até ficarem prontas.
  const archiveKey = item.featureKey || item.clientToggleKey;
  if (archiveKey && archivedKeys?.includes(archiveKey)) {
    return false;
  }

  // Gate por tenant feature flag (desligado no painel master = desaparece pro
  // CLIENTE). O super-admin (Leal Mídia) NUNCA perde o item — ele precisa
  // enxergar e operar tudo, mesmo o que está OFF pro cliente (aí ganha o selo).
  if (item.featureKey && features && features[item.featureKey] === false && !isSuper) {
    return false;
  }

  // Gate de acesso do cliente a feature gerenciada pela Leal Mídia.
  // Super-admin (Leal Mídia) SEMPRE vê; o cliente só vê se o toggle estiver
  // explicitamente ligado no painel de Funções do CRM (default OFF).
  if (item.clientToggleKey) {
    if (!isSuper && features?.[item.clientToggleKey] !== true) return false;
  }

  // Gate por tenant raiz (apenas no deploy principal, não em tenants de clientes)
  if ('rootTenantOnly' in item && item.rootTenantOnly && !isRootTenantHost()) {
    return false;
  }

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
  userEmail?: string,
  features?: Record<string, boolean>,
  archivedKeys?: string[]
): MenuItem[] => {
  const isSuper = isSuperAdminEmail(userEmail);
  // Só o super-admin recebe o selo "oculto pro cliente"; o cliente nunca vê
  // esses itens (foram filtrados), então nunca vê selo.
  const mark = (item: MenuItem | SubMenuItem) =>
    isSuper ? isHiddenFromClient(item, features) : false;

  return items
    .filter(item => shouldShowMenuItem(item, canFunction, canAnyFunction, canAllFunction, userRoleKey, userEmail, features, archivedKeys))
    .map((item): MenuItem | null => {
      // Se o item tem subitens, filtrar os subitens também
      if (item.subItems && item.subItems.length > 0) {
        const filteredSubItems = item.subItems
          .filter(subItem =>
            shouldShowMenuItem(subItem, canFunction, canAnyFunction, canAllFunction, userRoleKey, userEmail, features, archivedKeys)
          )
          .map(subItem => ({ ...subItem, hiddenFromClient: mark(subItem) }));

        // Se não há subitens visíveis, não mostrar o item pai
        if (filteredSubItems.length === 0) {
          return null;
        }

        return {
          ...item,
          hiddenFromClient: mark(item),
          subItems: filteredSubItems
        };
      }

      return { ...item, hiddenFromClient: mark(item) };
    })
    .filter((item): item is MenuItem => item !== null);
};
