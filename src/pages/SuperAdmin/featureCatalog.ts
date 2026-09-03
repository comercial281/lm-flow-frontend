// Organização do catálogo de Funções (o que a Leal Mídia liga/desliga por
// cliente) em TEMA > menu > funções daquele menu.
//
// Por que existe: o catálogo do servidor é uma lista de ~60 chaves. Ele já vem
// organizado por MENU do CRM, mas são ~18 menus — na tela isso continua sendo
// uma parede de interruptores em que ninguém acha nada na hora de montar o CRM
// de um cliente novo. O tema é a camada de cima, e junta os menus por assunto.
//
// Quem manda no tema é o SERVIDOR (config/lm_flow_feature_themes.yml no repo
// lm-flow): ele devolve `theme` e `theme_label` em cada item. O mapa daqui é só
// rede de segurança para a janela de deploy em que o servidor ainda é o antigo
// e não manda tema nenhum — sem ela, o painel voltaria a ser lista corrida no
// pior momento, que é logo depois de publicar.
//
// ⚠️ As chaves aqui NÃO são gate de funcionalidade: são o mapa de organização da
// tela. Os dois scanners do catálogo (scripts/sync-feature-catalog.mjs e
// scripts/audit-feature-catalog.mjs) só enxergam `featureKey:`,
// `clientToggleKey:`, `useFeature('...')` e `useClientToggle('...')` — nenhuma
// linha deste arquivo entra ou sai do catálogo por causa disso.

export interface CatalogItem {
  key: string;
  label?: string;
  name?: string;
  description?: string;
  group?: string;
  theme?: string;
  theme_label?: string;
}

export interface MenuBlock {
  key: string;
  label: string;
  /** O toggle do MENU INTEIRO: desligá-lo esconde o menu todo do cliente. */
  toggle?: CatalogItem;
  /** Funções de dentro do menu (um botão, uma ação). */
  items: CatalogItem[];
  /** Toggle + funções, na ordem em que a tela desenha. */
  all: CatalogItem[];
}

export interface ThemeSection {
  key: string;
  label: string;
  hint?: string;
  menus: MenuBlock[];
  all: CatalogItem[];
}

/** Ordem em que os temas aparecem na tela. Espelha o YAML do servidor. */
const THEMES: { key: string; label: string; hint: string }[] = [
  { key: 'visao_geral', label: 'Visão geral',            hint: 'A primeira tela que o cliente vê ao entrar' },
  { key: 'atendimento', label: 'Atendimento',            hint: 'Conversas, canais de WhatsApp e contatos' },
  { key: 'funil',       label: 'Funil e vendas',         hint: 'Quadro de leads, bolsão, visitas, propostas e contratos' },
  { key: 'imoveis',     label: 'Imóveis',                hint: 'Carteira, captação e interesses do lead' },
  { key: 'automacoes',  label: 'Automações e IA',        hint: 'IA Vendedora, follow-up, disparos e robôs' },
  { key: 'site',        label: 'Site e captação',        hint: 'Portal do cliente, landings de anúncio e formulários' },
  { key: 'extras',      label: 'Extras e configurações', hint: 'O que não muda a operação do dia a dia' },
];

const THEME_LABELS: Record<string, string> = Object.fromEntries(THEMES.map(t => [t.key, t.label]));
const THEME_HINTS: Record<string, string> = Object.fromEntries(THEMES.map(t => [t.key, t.hint]));
const THEME_ORDER: Record<string, number> = Object.fromEntries(THEMES.map((t, i) => [t.key, i]));

/** Tema em que cai o que não foi mapeado — no FIM, nunca escondido. */
const SEM_TEMA = 'outros';

// Reserva de tema por menu, usada só quando o servidor não manda `theme`.
const THEME_BY_GROUP: Record<string, string> = {
  dashboard: 'visao_geral',
  conversations: 'atendimento',
  channels: 'atendimento',
  contacts: 'atendimento',
  pipelines: 'funil',
  bolsao: 'funil',
  visits: 'funil',
  proposals: 'funil',
  contracts: 'funil',
  properties: 'imoveis',
  property_capture: 'imoveis',
  property_interests: 'imoveis',
  automations: 'automacoes',
  ai_agents: 'automacoes',
  disparos: 'automacoes',
  marketplace: 'extras',
  espaco: 'extras',
  tutorials: 'extras',
  settings: 'extras',
};

// O grupo "settings" do catálogo mistura assuntos: o Site Builder mora lá junto
// de Produtos. Chave listada aqui vence o tema do grupo dela.
const THEME_BY_KEY: Record<string, string> = {
  site_builder: 'site',
  landing_pages: 'site',
  dynamic_forms: 'site',
};

/** Nome de menu como o cliente o vê. Só entra aqui menu cujo catálogo não traz
 *  um item-toggle com rótulo próprio (o normal é ele trazer). */
const MENU_LABELS: Record<string, string> = {
  automations: 'Automações',
  ai_agents: 'Robôs e Integrações',
  settings: 'Configurações',
};

/** Menu de reserva para função solta: chave que o servidor devolveu sem menu
 *  (ou com o menu apontando para ela mesma, que é o chute do sincronizador). */
const MENU_AVULSO = '__avulsas__';

export function humanizeKey(key: string): string {
  return key
    .split('_')
    .map(p => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');
}

export function itemLabel(item: CatalogItem): string {
  return item.label || item.name || humanizeKey(item.key);
}

function themeOf(item: CatalogItem): string {
  return (
    item.theme ||
    THEME_BY_KEY[item.key] ||
    (item.group ? THEME_BY_GROUP[item.group] : '') ||
    SEM_TEMA
  );
}

function themeLabelOf(item: CatalogItem, theme: string): string {
  return item.theme_label || THEME_LABELS[theme] || (theme === SEM_TEMA ? 'Outras funções' : humanizeKey(theme));
}

// O menu de um item é o grupo dele — mas só quando esse menu EXISTE no catálogo,
// isto é, quando veio junto o item-toggle dele. Função apontando para um menu
// ausente entra como avulsa no fim do tema, em vez de abrir um bloco com nome de
// código no título (o grupo que o sincronizador do front chuta para chave nova é
// a própria chave dela).
function menuOf(item: CatalogItem, gruposDeMenu: Set<string>): string {
  const g = item.group;
  if (!g) return MENU_AVULSO;
  if (g === item.key) return g; // é o próprio toggle do menu
  return gruposDeMenu.has(g) ? g : MENU_AVULSO;
}

/**
 * Agrupa o catálogo em TEMA > menu > funções, preservando a ordem em que o
 * servidor mandou os itens dentro de cada bloco.
 */
export function groupCatalogByTheme(catalog: CatalogItem[]): ThemeSection[] {
  // Um grupo só é MENU de verdade quando existe o item-toggle dele (a convenção
  // do catálogo: o primeiro item do grupo tem key igual ao nome do grupo).
  const gruposDeMenu = new Set(
    catalog.filter(i => i.group && i.group === i.key).map(i => i.group as string)
  );

  const temas = new Map<string, { label: string; menus: Map<string, MenuBlock> }>();

  for (const item of catalog) {
    const themeKey = themeOf(item);
    if (!temas.has(themeKey)) temas.set(themeKey, { label: themeLabelOf(item, themeKey), menus: new Map() });
    const tema = temas.get(themeKey)!;

    const menuKey = menuOf(item, gruposDeMenu);
    if (!tema.menus.has(menuKey)) {
      tema.menus.set(menuKey, {
        key: menuKey,
        label: menuKey === MENU_AVULSO ? '' : (MENU_LABELS[menuKey] || humanizeKey(menuKey)),
        items: [],
        all: [],
      });
    }
    const menu = tema.menus.get(menuKey)!;

    if (menuKey !== MENU_AVULSO && item.key === menuKey) {
      menu.toggle = item;
      menu.label = itemLabel(item);
    } else {
      menu.items.push(item);
    }
  }

  const seções: ThemeSection[] = [];
  for (const [key, tema] of temas) {
    const menus = Array.from(tema.menus.values()).map(m => ({
      ...m,
      all: m.toggle ? [m.toggle, ...m.items] : m.items,
    }));
    // Função avulsa vai para o fim do tema: ela não tem menu para ancorar.
    menus.sort((a, b) => Number(a.key === MENU_AVULSO) - Number(b.key === MENU_AVULSO));

    seções.push({
      key,
      label: tema.label,
      hint: THEME_HINTS[key],
      menus,
      all: menus.flatMap(m => m.all),
    });
  }

  seções.sort((a, b) => {
    const oa = a.key in THEME_ORDER ? THEME_ORDER[a.key] : Number.MAX_SAFE_INTEGER;
    const ob = b.key in THEME_ORDER ? THEME_ORDER[b.key] : Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });

  return seções;
}

/** Filtro da busca: casa o nome que aparece na tela E a chave técnica, porque
 *  quem procura às vezes chega pelo nome do código (vindo de um chamado). */
export function matchesQuery(item: CatalogItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return itemLabel(item).toLowerCase().includes(q) || item.key.toLowerCase().includes(q);
}

export const AVULSAS_KEY = MENU_AVULSO;
