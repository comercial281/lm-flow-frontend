// ════════════════════════════════════════════════════════════════════════════
// Páginas lazy que aparecem no menu lateral (getCustomerMenuItems / menuItems.ts)
// ----------------------------------------------------------------------------
// Ficam num arquivo próprio (em vez de inline em routes/index.tsx) só pra essas
// páginas do menu principal poderem ser reaproveitadas TAMBÉM pelo prefetch de
// rotas (idle, ver src/hooks/useRoutePrefetch.ts e src/utils/routePrefetch.ts)
// sem duplicar o import() dinâmico em outro arquivo — routes/index.tsx importa
// essas MESMAS referências pra montar as <Route>. As demais páginas lazy do app
// (rotas sem item de menu direto: Área do Admin, callbacks OAuth, editores
// dinâmicos, integrações individuais, etc.) continuam declaradas inline em
// routes/index.tsx, sem necessidade de prefetch.
// ════════════════════════════════════════════════════════════════════════════
import { lazyWithRetry } from '@/utils/chunkReload';

// Dashboard reconstruído do zero na identidade do protótipo (DashboardV2). O
// antigo segue no repo, sem rota, até a nova tela rodar alguns dias em
// produção — remover no mesmo passo da troca deixaria sem para onde voltar.
export const Dashboard = lazyWithRetry(() => import('@/pages/Customer/DashboardV2'));
export const Contacts = lazyWithRetry(() => import('@/pages/Customer/Contacts'));
export const ScheduledActions = lazyWithRetry(() => import('@/pages/Customer/Contacts/ScheduledActions'));
export const Channels = lazyWithRetry(() => import('@/pages/Customer/Channels').then(m => ({ default: m.Channels })));
export const ChatPage = lazyWithRetry(() => import('@/pages/Customer/Chat/ChatPage'));
export const Pipelines = lazyWithRetry(() => import('@/pages/Customer/Pipelines/Pipelines'));
export const Bolsao = lazyWithRetry(() => import('@/pages/Customer/Bolsao/Bolsao'));
export const BolsaoBatches = lazyWithRetry(() => import('@/pages/Customer/Bolsao/BolsaoBatches'));
export const Disparos = lazyWithRetry(() => import('@/pages/Customer/Disparos/Disparos'));
export const TeamAccess = lazyWithRetry(() => import('@/pages/Customer/Team/TeamAccessPage'));
export const AccountSettings = lazyWithRetry(() => import('@/pages/Customer/Settings/Account').then(m => ({ default: m.AccountSettings })));
export const Labels = lazyWithRetry(() => import('@/pages/Customer/Settings/Labels'));
export const CustomAttributes = lazyWithRetry(() => import('@/pages/Customer/Settings/CustomAttributes'));
export const SiteBuilder = lazyWithRetry(() => import('@/pages/Customer/Settings/SiteBuilder').then(m => ({ default: m.SiteBuilder })));
export const Properties = lazyWithRetry(() => import('@/pages/Customer/Properties').then(m => ({ default: m.Properties })));
export const PropertyBooks = lazyWithRetry(() => import('@/pages/Customer/Properties').then(m => ({ default: m.PropertyBooks })));
export const Visits = lazyWithRetry(() => import('@/pages/Customer/Visits').then(m => ({ default: m.Visits })));
export const Proposals = lazyWithRetry(() => import('@/pages/Customer/Proposals').then(m => ({ default: m.Proposals })));
export const Contracts = lazyWithRetry(() => import('@/pages/Customer/Contracts').then(m => ({ default: m.Contracts })));
export const PropertyCaptureRequests = lazyWithRetry(() => import('@/pages/Customer/PropertyCapture').then(m => ({ default: m.PropertyCaptureRequests })));
export const PropertyInterests = lazyWithRetry(() => import('@/pages/Customer/PropertyInterests').then(m => ({ default: m.PropertyInterests })));
export const AutomationsLayout = lazyWithRetry(() => import('@/pages/Customer/Automations/AutomationsLayout'));
export const SalesAgents = lazyWithRetry(() => import('@/pages/Customer/Automations/SalesAgents/SalesAgents'));
export const PortalsList = lazyWithRetry(() => import('../pages/Customer/Settings/Portals/PortalsList'));
export const DashboardAppPage = lazyWithRetry(() => import('../pages/Customer/DashboardApp'));
export const Tutorials = lazyWithRetry(() => import('@/pages/Customer/Tutorials'));
export const Marketplace = lazyWithRetry(() => import('@/pages/Shared/Marketplace'));
// Espaço — módulo "Notion por tenant" (portado do LM Hub). Item de menu
// (clientToggleKey: 'espaco'), por isso entra aqui também — não só a rota
// pública por token (EspacoPublicRoute, que fica inline em routes/index.tsx).
export const Espaco = lazyWithRetry(() => import('@/features/espaco/Espaco'));

/**
 * path -> função de prefetch (mesmo __preload do lazyWithRetry, com retry
 * embutido). Usado pelo prefetch ocioso (ver useRoutePrefetch.ts). Cada chave
 * é o `href` exato de um item (ou sub-item) de getCustomerMenuItems.
 */
export const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': Dashboard.__preload,
  '/conversations': ChatPage.__preload,
  '/contacts': Contacts.__preload,
  '/contacts/scheduled-actions': ScheduledActions.__preload,
  '/pipelines': Pipelines.__preload,
  '/bolsao': Bolsao.__preload,
  '/bolsao/listas': BolsaoBatches.__preload,
  '/disparos': Disparos.__preload,
  '/ia-vendedora': SalesAgents.__preload,
  '/espaco': Espaco.__preload,
  '/equipe': TeamAccess.__preload,
  '/properties': Properties.__preload,
  '/books': PropertyBooks.__preload,
  '/settings/portals': PortalsList.__preload,
  '/visits': Visits.__preload,
  '/proposals': Proposals.__preload,
  '/contracts': Contracts.__preload,
  '/property-capture-requests': PropertyCaptureRequests.__preload,
  '/property-interests': PropertyInterests.__preload,
  '/channels': Channels.__preload,
  '/automations': AutomationsLayout.__preload,
  '/marketplace': Marketplace.__preload,
  '/tutorials': Tutorials.__preload,
  '/settings/account': AccountSettings.__preload,
  '/settings/labels': Labels.__preload,
  '/settings/attributes': CustomAttributes.__preload,
  '/settings/site-builder': SiteBuilder.__preload,
  // Módulo de dashboards embutidos (n8n/apps de cliente): a rota real tem
  // :appId dinâmico (/dashboard-app/<uuid>), então a chave aqui é só o
  // prefixo — routePrefetch.ts casa por startsWith quando não acha exato.
  '/dashboard-app': DashboardAppPage.__preload,
};

/**
 * Todo o routePrefetchMap acima já é só páginas do menu do CLIENTE
 * (getCustomerMenuItems) — a Área do Admin (/admin/*) e as telas de
 * /super-admin/* ficam de fora de propósito: são baixo tráfego (só a Leal
 * Mídia acessa) e continuam declaradas inline em routes/index.tsx, sem
 * entrar no prefetch ocioso.
 */
export const CUSTOMER_IDLE_PREFETCH_PATHS: string[] = Object.keys(routePrefetchMap);
