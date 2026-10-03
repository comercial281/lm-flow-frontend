/** Rotas do chat (/conversations e /conversations/:id). Mesma regra do FeedbackWidget. */
export const ROTA_CONVERSAS = /^\/conversations(\/|$)/;

/**
 * Rotas em que o menu nasce recolhido: Conversas e o cadastro de imóvel
 * (/properties/new e /properties/:id/editar), que precisa da largura para o
 * índice e as seções. Mesma regra: a escolha vale só para a visita.
 */
export const ROTA_RECOLHE_MENU = /^\/(conversations|properties\/new|properties\/[^/]+\/editar)(\/|$)/;

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
