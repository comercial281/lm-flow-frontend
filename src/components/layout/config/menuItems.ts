import { LucideIcon } from 'lucide-react';
import { permissionForPath } from '@/routes/permissionRoutes';
import {
  User,
  LogOut,
  MessageSquare,
  Contact,
  SquareKanban,
  Inbox,
  ListChecks,
  Hand,
  Bot,
  PieChart,
  Users,
  Users2,
  Tags,
  GraduationCap,
  Zap,
  Building2,
  Building,
  CalendarClock,
  Globe,
  FileText,
  Megaphone,
  LifeBuoy,
  Rocket,
  Repeat,
  Shuffle,
  ClipboardList,
  Facebook,
  Plug,
  Smartphone,
  Target,
  Share2,
  SlidersHorizontal,
  Braces,
  UserRoundCheck,
} from 'lucide-react';
import { openSupport } from '@/components/support/openSupport';

export interface MenuItem {
  id?: string;
  name: string;
  href: string;
  icon: LucideIcon;
  /**
   * Abas da página que o item abre (menu novo, fase 4). O menu mostra só o
   * item; as abas aparecem no topo da página, pela `PaginaComAbas`, lidas
   * DESTA lista — menu e abas não têm como discordar. Cada aba confere o
   * cargo sozinha; o item some quando nenhuma aba sobrevive, e o `href` dele
   * vira o da primeira aba visível.
   */
  abas?: SubMenuItem[];
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
  /** O inverso: some no painel raiz (app.lmflow), tela que só faz sentido no CRM do cliente. */
  hideOnRoot?: boolean;
  /**
   * Anotado em runtime (não configurar à mão): true quando o item está visível
   * pra ele (super-admin) mas OCULTO pro cliente pelo estado atual dos toggles.
   * O Sidebar usa isso pra mostrar o selo "oculto pro cliente" — só o super vê.
   */
  hiddenFromClient?: boolean;
  /**
   * Anotado em runtime (não configurar à mão): bolinha vermelha de novidade ao
   * lado do nome. Hoje só a Gestão de proprietários usa, quando chega captação
   * nova (ver `aplicarProprietariosNoMenu`).
   */
  marcador?: boolean;
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
  hideOnRoot?: boolean;
  hiddenFromClient?: boolean;
  /**
   * A aba só fica ativa no endereço EXATO. Para a aba cujo endereço é prefixo
   * de outra aba da mesma página (/bolsao e /bolsao/listas).
   */
  exata?: boolean;
}

/**
 * Seção do menu (fase 4, modelo da Lais): abre e fecha, uma por vez. A `fixa`
 * (Principal) fica sempre aberta e não entra nessa conta. Seção sem nenhum item
 * que o cargo veja não aparece.
 */
export interface MenuSection {
  id: string;
  rotulo: string;
  icone?: LucideIcon;
  fixa?: boolean;
  itens: MenuItem[];
}

export interface ProfileMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Chave `recurso.acao` que a pessoa precisa ter para ver o item. */
  permissao?: string;
}

/**
 * Itens SEM cargo, por decisão registrada: o servidor não confere cargo neles.
 * Tutoriais: lê o Supabase do LM Hub, não a API do CRM.
 * Todo o resto declara a permissão — há spec que reprova item novo sem ela.
 */
export const MENU_FREE_BY_DESIGN = ['/tutorials'];

/**
 * FORA DO MENU (01/10/2026, decisão do Tony). As telas continuam no ar e abrem
 * pelo endereço digitado; só não têm entrada no menu, nem para a Leal Mídia.
 *
 * Em breve (voltam quando estiverem prontas):
 *   - Propostas ............ /proposals
 *   - Contratos ............ /contracts
 *   - Captação ............. /property-capture-requests (vira a aba Novas
 *     captações da Gestão de proprietários, que voltou ao menu em 03/10/2026)
 *   - Plano/assinatura (ainda sem tela)
 * Sem plano de voltar:
 *   - Interesses ........... /property-interests
 *   - Ações agendadas ...... /contacts/scheduled-actions
 *   - Marketplace .......... /marketplace
 * Saíram em 03/10/2026 (Automações · sprint 2): a página Automações virou o
 * construtor de fluxos. Abrem pelo endereço (suporte, avisos do Follow-up):
 *   - Regras de lead ....... /automations/lead-automations
 *   - Lembretes ............ /automations/whatsapp-reminders
 *
 * Também saiu o "Personalizar menu" (esconder/favoritar/reordenar): com seções
 * fixas ele quebrava os rótulos. Ver a seção "Menu novo" no CLAUDE.md.
 */

/**
 * Fonte única de chave (ruling do controlador, Fase 1 — Cargos, task B5): para
 * todo item cujo `href` tem rota protegida em `ROUTE_PERMISSIONS` (a B4), a
 * chave vem DAQUELE mapa — nunca uma segunda cópia digitada aqui, que poderia
 * divergir dele com o tempo. Uso: `{ ...permissionFromRoute('/disparos') }`.
 */
function permissionFromRoute(href: string): { resource: string; action: string } {
  const entry = permissionForPath(href);
  if (!entry) {
    throw new Error(`menuItems: href "${href}" não está em ROUTE_PERMISSIONS`);
  }
  return { resource: entry.resource, action: entry.action };
}

/**
 * TELA DE GESTÃO no menu: a chave da rota + uma chave de escrita.
 *
 * O Corretor de fábrica LÊ etiquetas, variáveis e o site (usa no chat e nos
 * leads) — e com a chave da rota sozinha ganharia, no menu, a seção Minha
 * imobiliária e o "Meu site", que são de quem configura. O menu pede também a
 * escrita, que o Gerente tem e o Corretor não. A rota continua aberta para
 * quem lê: é só o menu que não oferece. Mesmo motivo da aba WhatsApp.
 */
function gestao(href: string, escrita: string): { permissions: string[]; requireAll: true } {
  const { resource, action } = permissionFromRoute(href);
  return { permissions: [`${resource}.${action}`, escrita], requireAll: true };
}

/** Item com abas: aparece para quem vê qualquer uma delas (o filtro confere aba a aba). */
function itemComAbas(item: Omit<MenuItem, 'href' | 'abas'>, abas: SubMenuItem[]): MenuItem {
  return { ...item, href: abas[0].href, abas };
}

export const getCustomerMenuSections = (): MenuSection[] => [
  {
    id: 'principal',
    rotulo: 'Principal',
    fixa: true,
    itens: [
      { name: 'Dashboard', href: '/dashboard', icon: PieChart, ...permissionFromRoute('/dashboard'), featureKey: 'dashboard' },
      { name: 'Conversas', href: '/conversations', icon: MessageSquare, ...permissionFromRoute('/conversations'), featureKey: 'conversations' },
      { name: 'Funil de vendas', href: '/pipelines', icon: SquareKanban, ...permissionFromRoute('/pipelines'), featureKey: 'pipelines' },
      { name: 'Visitas', href: '/visits', icon: CalendarClock, ...permissionFromRoute('/visits'), featureKey: 'visits' },
    ],
  },
  {
    id: 'imoveis',
    rotulo: 'Imóveis',
    icone: Building2,
    itens: [
      { name: 'Meus imóveis', href: '/properties', icon: Building2, ...permissionFromRoute('/properties'), featureKey: 'properties' },
      // Proprietários da revenda + Novas captações do site. O cargo só pede a
      // leitura; o resto é decidido em runtime (`aplicarProprietariosNoMenu`,
      // no MainLayout): o gestor sempre vê, o corretor só com algum
      // proprietário liberado para ele. A bolinha é captação nova não vista.
      { id: 'proprietarios', name: 'Gestão de proprietários', href: '/property-owners', icon: UserRoundCheck, ...permissionFromRoute('/property-owners'), featureKey: 'properties' },
      // Gestão do site: pede `sites.update` além da leitura (ver `gestao`).
      { name: 'Meu site', href: '/settings/site-builder', icon: Globe, ...gestao('/settings/site-builder', 'sites.update'), featureKey: 'site_builder' },
      // Books (PDF) salvos nos imóveis — visualizar e baixar
      { name: 'Books', href: '/books', icon: FileText, ...permissionFromRoute('/books'), featureKey: 'properties' },
    ],
  },
  {
    id: 'leads',
    rotulo: 'Leads',
    icone: Users,
    itens: [
      { name: 'Contatos', href: '/contacts', icon: Contact, ...permissionFromRoute('/contacts'), featureKey: 'contacts' },
      // Bolsão — a lista de leads sem dono que o corretor se serve.
      //
      // "Pegar leads" é do CORRETOR (`bolsao_leads.read`); "Listas e regras" é
      // do GESTOR. O corretor vê o item e cai na página sem a fileira de abas.
      //
      // clientToggleKey, e NÃO featureKey: `featureKey` só esconde quando a
      // chave vale exatamente false, ou seja AUSÊNCIA = LIGADO — o Bolsão
      // estrearia para todas as imobiliárias no primeiro deploy. Com
      // `clientToggleKey` o cliente só vê quando a chave vale true e a Leal
      // Mídia sempre vê, o que permite liberar cliente a cliente.
      //
      // ⚠️ ESTA LINHA É METADE DA TRAVA. A outra metade é `bolsao` estar em
      // ClientInstance::DEFAULT_OFF_FEATURES no backend: o endpoint público
      // resolve chave AUSENTE como `true`, então sem a lista de lá o cliente
      // receberia `bolsao: true` e o menu apareceria para todo mundo — que foi
      // exatamente o furo em 25/08/2026. Mexeu numa, confira a outra.
      itemComAbas({ id: 'customer-bolsao', name: 'Bolsão', icon: Inbox, clientToggleKey: 'bolsao' }, [
        { name: 'Pegar leads', href: '/bolsao', icon: Hand, ...permissionFromRoute('/bolsao'), clientToggleKey: 'bolsao', exata: true },
        { name: 'Listas e regras', href: '/bolsao/listas', icon: ListChecks, ...permissionFromRoute('/bolsao/listas'), clientToggleKey: 'bolsao' },
      ]),
    ],
  },
  {
    id: 'vendas',
    rotulo: 'Vendas e automação',
    icone: Zap,
    itens: [
      // Funis de mensagem = os funis de conversa do corretor (sprint 4 das
      // Automações, 04/10/2026): sequências que ele dispara na conversa, montadas
      // no construtor a partir de modelos. O Corretor de fábrica tem
      // `message_funnels.read` (backend lm-flow#388) e vê este item: é o único da
      // seção pra quem não tem acesso às Automações.
      { name: 'Funis de mensagem', href: '/automations/message-funnels', icon: Rocket, ...permissionFromRoute('/automations/message-funnels'), featureKey: 'message_funnels' },
      { name: 'Disparos', href: '/disparos', icon: Megaphone, ...permissionFromRoute('/disparos'), featureKey: 'disparos' },
      // Feature gerenciada pela Leal Mídia: super-admin SEMPRE vê; cliente só se ligar o toggle.
      { name: 'IA Vendedora', href: '/ia-vendedora', icon: Bot, ...permissionFromRoute('/ia-vendedora'), clientToggleKey: 'client_manage_automations' },
      { name: 'Follow-up', href: '/automations/follow-ups', icon: Repeat, ...permissionFromRoute('/automations/follow-ups'), featureKey: 'follow_ups' },
      // Automações = "quando X acontecer, faça Y": o construtor de fluxos, direto
      // na lista (sprint 2, 03/10/2026). Reusa a função das regras por não ter
      // registro próprio. "Regras de lead" e "Lembretes" saíram do menu e abrem
      // só pelo endereço (suporte e avisos da tela de Follow-up apontam pra lá).
      { name: 'Automações', href: '/automations/flow-builder', icon: Zap, ...permissionFromRoute('/automations/flow-builder'), featureKey: 'lead_automations', clientToggleKey: 'client_manage_automations' },
    ],
  },
  {
    id: 'imobiliaria',
    rotulo: 'Minha imobiliária',
    icone: Building,
    itens: [
      // Gate da rota é accounts.read: o menu casa com ele, senão o corretor vê o item e cai no aviso do cargo.
      { name: 'Conta', href: '/settings/account', icon: User, ...permissionFromRoute('/settings/account') },
      // Usuários, Times e Cargos e Permissões são abas da tela Equipe (rotas antigas redirecionam).
      { name: 'Equipe', href: '/equipe', icon: Users2, ...permissionFromRoute('/equipe') },
      itemComAbas({ name: 'Integrações', icon: Plug }, [
        // A aba pede `inboxes.update` além da chave da rota: o Corretor tem
        // `channels.read` (religa o número em que ELE atende, desde 04/09/2026)
        // e, sem isto, ganharia a seção Minha Imobiliária inteira só por causa
        // dela. Ele chega na mesma tela por "Meus números", no avatar.
        // `inboxes.update` é o "vejo qualquer número", que o Gerente tem pelo
        // piso de reparos e o Corretor não.
        { name: 'WhatsApp', href: '/channels', icon: Smartphone, ...gestao('/channels', 'inboxes.update'), featureKey: 'channels' },
        // Páginas do Facebook/Instagram dos Lead Ads (era a aba de Origem). Mesmas
        // travas da antiga Origem: some no painel raiz, e o cliente só vê com a
        // função de automações liberada pela Leal Mídia.
        { name: 'Facebook', href: '/settings/facebook', icon: Facebook, ...permissionFromRoute('/settings/facebook'), featureKey: 'lead_automations', clientToggleKey: 'client_manage_automations', hideOnRoot: true },
        { name: 'Pixel', href: '/settings/pixel-capi', icon: Target, ...permissionFromRoute('/settings/pixel-capi'), featureKey: 'lead_automations' },
        // Portais imobiliários (ZAP, Imóvel Web…) — feed + leads
        { name: 'Portais', href: '/settings/portals', icon: Share2, ...permissionFromRoute('/settings/portals'), featureKey: 'properties' },
      ]),
      // Tela única de distribuição: modo + quem participa + prazo + gestor.
      { name: 'Roleta de leads', href: '/automations/roleta-config', icon: Shuffle, ...permissionFromRoute('/automations/roleta-config'), featureKey: 'lead_automations' },
      // Formulários dos Lead Ads (endereço antigo da tela Origem). A conexão da
      // página do Facebook está em Integrações → Facebook desde 01/10/2026.
      { name: 'Formulários', href: '/automations/origem', icon: ClipboardList, ...permissionFromRoute('/automations/origem'), featureKey: 'lead_automations', clientToggleKey: 'client_manage_automations', hideOnRoot: true },
      { name: 'Etiquetas', href: '/settings/labels', icon: Tags, ...gestao('/settings/labels', 'labels.create') },
      { name: 'Campos personalizados', href: '/settings/attributes', icon: SlidersHorizontal, ...permissionFromRoute('/settings/attributes') },
      // As variáveis ({{empreendimento}}…) que a imobiliária cria pros textos. Era
      // aba de Campos personalizados e dos Funis de mensagem; desde a sprint 4
      // das Automações (04/10/2026) é item próprio. No construtor elas viram
      // botõezinhos na caixa de mensagem.
      { name: 'Variáveis de mensagem', href: '/settings/template-variables', icon: Braces, ...gestao('/settings/template-variables', 'canned_responses.create') },
    ],
  },
];

/** Rodapé fixo do menu. */
export const getFooterMenuItems = (): MenuItem[] => [
  // Sem cargo: ver MENU_FREE_BY_DESIGN.
  { name: 'Guia do LM Flow', href: '/tutorials', icon: GraduationCap, featureKey: 'tutorials' },
];

/** Todo item e toda aba do menu, numa lista só (busca, testes). */
export function itensDoMenu(secoes: MenuSection[], rodape: MenuItem[] = []): (MenuItem | SubMenuItem)[] {
  return [...secoes.flatMap(s => s.itens), ...rodape].flatMap(i => [i as MenuItem | SubMenuItem, ...(i.abas ?? [])]);
}

/** Endereço casa com o item (ou com o começo dele, para telas internas como /pipelines/:id). */
export function enderecoCasa(pathname: string, href: string, exata = false): boolean {
  if (!href || href === '#') return false;
  if (pathname === href) return true;
  return !exata && pathname.startsWith(href + '/');
}

/** Item ativo: o endereço é dele ou de qualquer aba dele. */
export function itemAtivo(item: MenuItem, pathname: string): boolean {
  if (item.abas?.length) return item.abas.some(aba => enderecoCasa(pathname, aba.href, aba.exata));
  return enderecoCasa(pathname, item.href);
}

/**
 * Item (e aba) do menu dono do endereço. Ganha o casamento mais longo, para
 * /automations/flow-builder/:id cair em Automações e não em outro item.
 */
export function donoDoEndereco(
  secoes: MenuSection[],
  pathname: string,
): { secao: MenuSection; item: MenuItem; aba?: SubMenuItem } | null {
  let melhor: { secao: MenuSection; item: MenuItem; aba?: SubMenuItem; tamanho: number } | null = null;
  for (const secao of secoes) {
    for (const item of secao.itens) {
      const candidatos: { href: string; exata?: boolean; aba?: SubMenuItem }[] = item.abas?.length
        ? item.abas.map(aba => ({ href: aba.href, exata: aba.exata, aba }))
        : [{ href: item.href }];
      for (const c of candidatos) {
        if (enderecoCasa(pathname, c.href, c.exata) && (!melhor || c.href.length > melhor.tamanho)) {
          melhor = { secao, item, aba: c.aba, tamanho: c.href.length };
        }
      }
    }
  }
  return melhor ? { secao: melhor.secao, item: melhor.item, aba: melhor.aba } : null;
}

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
    // Atalho do corretor para religar o WhatsApp em que ele atende (a tela já
    // mostra só os números dele). O gestor chega na mesma tela por Minha
    // imobiliária → Integrações.
    {
      name: 'Meus números',
      href: '/channels',
      icon: Smartphone,
      onClick: () => navigate('/channels'),
      permissao: 'channels.read',
    },
    // Entrada fixa para o card de suporte. Necessária porque na aba de
    // Conversas a bolinha é escondida (cobria o botão de enviar).
    {
      name: t('profile.feedback'),
      href: '#',
      icon: LifeBuoy,
      onClick: () => openSupport(),
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
  archivedKeys?: string[],
  // Suporte da Leal Mídia (Fase 1 — Cargos): vem do SERVIDOR (useIsSuperAdmin),
  // nunca mais deduzido do e-mail aqui. Suporte vê e opera tudo, mesmo o que
  // está OFF pro cliente.
  isSupport = false
): boolean => {
  const isSuper = isSupport;

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
  if (item.hideOnRoot && isRootTenantHost()) {
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

// Filtra itens (e as abas de cada um) por cargo, função do cliente e arquivamento.
export const filterMenuItemsByPermissions = (
  items: MenuItem[],
  canFunction: (resource: string, action: string) => boolean,
  canAnyFunction: (permissions: string[]) => boolean,
  canAllFunction: (permissions: string[]) => boolean,
  userRoleKey?: string,
  userEmail?: string,
  features?: Record<string, boolean>,
  archivedKeys?: string[],
  // Ver o comentário em shouldShowMenuItem.
  isSupport = false
): MenuItem[] => {
  const isSuper = isSupport;
  // Só o super-admin recebe o selo "oculto pro cliente"; o cliente nunca vê
  // esses itens (foram filtrados), então nunca vê selo.
  const mark = (item: MenuItem | SubMenuItem) =>
    isSuper ? isHiddenFromClient(item, features) : false;
  const mostra = (item: MenuItem | SubMenuItem) =>
    shouldShowMenuItem(item, canFunction, canAnyFunction, canAllFunction, userRoleKey, userEmail, features, archivedKeys, isSupport);

  return items
    .map((item): MenuItem | null => {
      if (item.abas && item.abas.length > 0) {
        // Item com abas: vale a regra de cada aba. Ele aparece se alguma
        // sobrevive, e leva para a primeira que sobreviveu.
        if (!mostra({ ...item, resource: undefined, action: undefined, permissions: undefined })) return null;
        const abas = item.abas.filter(mostra).map(aba => ({ ...aba, hiddenFromClient: mark(aba) }));
        if (abas.length === 0) return null;
        return { ...item, href: abas[0].href, abas, hiddenFromClient: mark(item) };
      }
      return mostra(item) ? { ...item, hiddenFromClient: mark(item) } : null;
    })
    .filter((item): item is MenuItem => item !== null);
};

/** Mesmo filtro, seção a seção. Seção que fica sem item some. */
export const filterMenuSections = (
  secoes: MenuSection[],
  ...regras: Parameters<typeof filterMenuItemsByPermissions> extends [unknown, ...infer R] ? R : never
): MenuSection[] =>
  secoes
    .map(secao => ({ ...secao, itens: filterMenuItemsByPermissions(secao.itens, ...regras) }))
    .filter(secao => secao.itens.length > 0);
