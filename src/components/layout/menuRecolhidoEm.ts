/** Rotas do chat (/conversations e /conversations/:id). Mesma regra do SupportWidget (rotaComAba). */
export const ROTA_CONVERSAS = /^\/conversations(\/|$)/;

/**
 * Rotas em que o menu nasce recolhido: Conversas, o cadastro de imóvel
 * (/properties/new e /properties/:id/editar), que precisa da largura para o
 * índice e as seções, e o funil aberto (/pipelines/:id e o card completo), que
 * precisa da largura para as colunas, e o mapa aberto de Automações (flow-builder,
 * message-funnels e follow-ups, com id). As listas de funis (/pipelines) e de
 * Automações não recolhem. Mesma regra: a escolha vale só para a visita.
 */
export const ROTA_RECOLHE_MENU = /^\/(conversations|properties\/new|properties\/[^/]+\/editar|pipelines\/[^/]+|automations\/(flow-builder|message-funnels|follow-ups)\/[^/]+)(\/|$)/;

const ROTA_IA_NOVO = /^\/ia-vendedora\/novo\/?$/;
const ROTA_IA_VENDEDORA = /^\/ia-vendedora\/?$/;

/**
 * Quem decide se o menu recolhe: as rotas de `ROTA_RECOLHE_MENU` (pelo pathname) e a
 * IA Vendedora no Configurar e no Ensinar (Tarefa 70, 01/11/2026), que precisam da largura
 * do índice mais a página, e o Novo agente em tela cheia. A página de agentes e o Painel
 * não recolhem.
 *
 * ⚠️ A IA Vendedora é UMA rota (`/ia-vendedora`) e a tela vem no `?tela=`: por isso esta
 * regra lê o `search`, e o MainLayout precisa passar `location.search` junto do pathname.
 */
export function recolheMenu(pathname: string, search = ''): boolean {
  if (ROTA_RECOLHE_MENU.test(pathname) || ROTA_IA_NOVO.test(pathname)) return true;
  if (!ROTA_IA_VENDEDORA.test(pathname)) return false;
  const tela = new URLSearchParams(search).get('tela');
  return tela === 'configurar' || tela === 'ensinar';
}

interface EntradaMenuRecolhido {
  /** Preferência salva da pessoa (localStorage). */
  salvo: boolean;
  emConversas: boolean;
  /** Escolha feita nesta visita a Conversas pelo botão do menu; não é gravada. */
  escolhaNaVisita: boolean | null;
}

/**
 * Em Conversas o menu nasce recolhido para caber o painel do lead, sem mexer
 * na preferência salva. Fora de Conversas vale a preferência.
 */
export function menuRecolhido({ salvo, emConversas, escolhaNaVisita }: EntradaMenuRecolhido): boolean {
  return emConversas ? (escolhaNaVisita ?? true) : salvo;
}
