// Frase de fundo do campo de mensagem. Quando o campo está travado, a frase diz
// a causa real (número desconectado ou janela de 24 h fechada), não "permissão".
export interface EntradaFraseDoCampo {
  pendente: boolean;
  desconectado: boolean;
  janelaFechada: boolean;
  /** Frases de hoje (vêm do i18n) para os casos pendente e normal. */
  textoPendente: string;
  textoPadrao: string;
}

export const FRASE_DESCONECTADO = 'Seu WhatsApp está desconectado. Reconecte o número para responder.';
export const FRASE_JANELA_FECHADA =
  'Faz mais de 24 h que o lead não escreve. Envie um modelo de mensagem para retomar.';

export function fraseDoCampo(e: EntradaFraseDoCampo): string {
  if (e.pendente) return e.textoPendente;
  if (e.desconectado) return FRASE_DESCONECTADO;
  if (e.janelaFechada) return FRASE_JANELA_FECHADA;
  return e.textoPadrao;
}
