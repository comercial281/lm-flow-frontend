/**
 * Canal global para abrir o diálogo de "Sugestões/Bugs".
 *
 * O diálogo mora no FeedbackWidget (montado uma única vez no MainLayout), mas
 * precisa ser aberto de fora — o menu do perfil, por exemplo — porque na aba de
 * Conversas o botão flutuante é escondido (ele cobria o botão de enviar
 * mensagem). Um evento no window evita ter que passar estado pelo layout.
 */
export const FEEDBACK_OPEN_EVENT = 'lmflow:open-feedback';

export function openFeedbackDialog(): void {
  window.dispatchEvent(new CustomEvent(FEEDBACK_OPEN_EVENT));
}
