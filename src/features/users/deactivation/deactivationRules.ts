import type { DeactivationPreview, DeactivatePayload, DeactivationReason, User } from '@/types/users';

/**
 * As regras da janela *Desativar corretor*.
 *
 * Moram em arquivo próprio, com teste, e não dentro da janela: a mais
 * importante delas — desconectar o WhatsApp EXIGE escolher quem fica com os
 * leads — é invisível na tela e, quando falha, o efeito não aparece em lugar
 * nenhum. Número desconectado não recebe mensagem: o lead que responder na
 * conversa antiga (e é o que ele vai fazer, é a conversa que ele conhece) cai
 * num número desligado e ninguém vê.
 *
 * A outra regra invisível: a opção de desconectar só existe para o número
 * EXCLUSIVO dele. Num compartilhado, desconectar derrubaria o WhatsApp da
 * imobiliária inteira.
 */

export const DEACTIVATION_REASONS: DeactivationReason[] = ['ferias', 'afastamento', 'saiu'];

export interface DeactivationChoice {
  reason: DeactivationReason;
  /** null = deixa os leads como estão, com quem está saindo. */
  transferToId: string | null;
  disconnectNumber: boolean;
}

/**
 * A opção de desconectar o WhatsApp só é oferecida quando ele tem número
 * exclusivo. Sem isto a tela ofereceria derrubar um número compartilhado.
 */
export function canOfferDisconnect(preview: DeactivationPreview | null): boolean {
  return Boolean(preview?.exclusive_number?.inbox_id || preview?.exclusive_number?.name);
}

/**
 * Ele tem carteira? Só quando tem é que o destino dos leads vira obrigatório
 * junto com o desconectar — cobrar destino de quem não tem lead nenhum seria uma
 * pergunta sem resposta possível.
 */
export function hasLeads(preview: DeactivationPreview | null): boolean {
  return (preview?.leads ?? 0) > 0 || (preview?.open_conversations ?? 0) > 0;
}

/**
 * O que impede confirmar. Devolve a frase que a tela mostra, ou null quando
 * está tudo certo — nunca um booleano solto: quem lê "não posso confirmar"
 * precisa saber por quê, no mesmo lugar.
 */
export function blockingReason(
  choice: DeactivationChoice,
  preview: DeactivationPreview | null,
): string | null {
  if (!DEACTIVATION_REASONS.includes(choice.reason)) {
    return 'Escolha o motivo da desativação.';
  }

  if (choice.disconnectNumber && !choice.transferToId && hasLeads(preview)) {
    return (
      'Para desconectar o WhatsApp dele, escolha quem fica com os leads: ' +
      'o lead que responder na conversa antiga cairia num número desligado.'
    );
  }

  return null;
}

/**
 * O que viaja para o servidor.
 *
 * `disconnect_number` só sai verdadeiro quando a opção era oferecida de fato:
 * a caixa pode ter ficado marcada de uma abertura anterior da janela, e mandar
 * "desconecta" para quem não tem número exclusivo é pedir ao servidor algo que
 * ele vai ignorar — silêncio dos dois lados.
 */
export function buildDeactivatePayload(
  choice: DeactivationChoice,
  preview: DeactivationPreview | null,
): DeactivatePayload {
  return {
    reason: choice.reason,
    transfer_to_id: choice.transferToId,
    disconnect_number: choice.disconnectNumber && canOfferDisconnect(preview),
  };
}

/**
 * Quem pode aparecer como destino da carteira: gente ativa, que não seja a
 * própria pessoa que está saindo. Oferecer alguém já desativado passaria a
 * carteira para outro silêncio.
 */
export function transferCandidates(users: User[], leaving: User | null): User[] {
  return users.filter(u => u.id !== leaving?.id && !u.deactivated);
}

/**
 * Quem este cargo pode desativar. O gestor desativa CORRETOR; gestor e
 * administrador só o administrador desativa.
 *
 * A mesma régua roda no servidor — esta aqui existe para a tela não oferecer um
 * botão que a API vai recusar, que é o defeito mais caro deste tipo de recorte.
 */
export function canDeactivate(actor: User | null, target: User | null): boolean {
  if (!actor || !target) return false;
  if (actor.id === target.id) return false;

  const actorRole = actor.chave_role ?? actor.role?.key;
  const targetRole = target.chave_role ?? target.role?.key;

  if (actorRole === 'admin' || actorRole === 'administrator') return true;

  return targetRole === 'agent';
}
