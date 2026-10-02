/** Rotas do chat (/conversations e /conversations/:id). Mesma regra do FeedbackWidget. */
export const ROTA_CONVERSAS = /^\/conversations(\/|$)/;

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
