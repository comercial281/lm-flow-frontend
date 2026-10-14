import type { Conversation } from '@/types/chat/api';

/** Nome que entra na frase do Atribuir ("…a conversa com {{name}}"): é o lead, não o atendente atual. */
export function nomeDaFraseDoAtribuir(conversa: Conversation, alternativa: string): string {
  return conversa.contact?.name || alternativa;
}
