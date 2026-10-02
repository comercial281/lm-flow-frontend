// Item da lista de conversas: o que a linha mostra além do nome.
// Funções puras (aceitam `agora`) pra testar sem relógio nem componente.
import { tempoDesde } from '@/lib/formato';
import type { Conversation, Message } from '@/types/chat/api';

// O serializer manda message_type como inteiro (0 entrada, 1 saída) ou texto.
function ehDoLead(tipo: unknown): boolean {
  return tipo === 0 || tipo === 'incoming';
}

/** "sem resposta há 3 h" quando o lead escreveu por último e ninguém respondeu; senão null. */
export function esperaDoLead(
  conv: Pick<Conversation, 'waiting_since' | 'last_non_activity_message' | 'status'>,
  agora: Date = new Date(),
): string | null {
  if (conv.status !== 'open') return null;
  if (!conv.waiting_since || conv.waiting_since <= 0) return null;
  if (!ehDoLead(conv.last_non_activity_message?.message_type)) return null;
  return `sem resposta ${tempoDesde(conv.waiting_since, agora)}`;
}

/** Segundos Unix da última mensagem de verdade; sem ela, o timestamp da conversa. */
export function horaDoItem(conv: Pick<Conversation, 'timestamp' | 'last_non_activity_message'>): number {
  const criada = conv.last_non_activity_message?.created_at;
  if (criada) {
    const ms = Date.parse(criada);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    const n = Number(criada);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n : Math.floor(n / 1000);
  }
  return conv.timestamp;
}

/** Ordem da lista: fixadas primeiro, depois pelo horário que o item mostra (mais novo em cima). */
export function ordemDaLista(
  a: Pick<Conversation, 'timestamp' | 'last_non_activity_message' | 'custom_attributes'>,
  b: Pick<Conversation, 'timestamp' | 'last_non_activity_message' | 'custom_attributes'>,
): number {
  const fa = Boolean(a.custom_attributes?.pinned);
  const fb = Boolean(b.custom_attributes?.pinned);
  if (fa !== fb) return fa ? -1 : 1;
  return horaDoItem(b) - horaDoItem(a);
}

/**
 * Decisão do onMessageUpdated: devolve a conversa atualizada ou null (nada a mudar).
 * Atividade e status de leitura NUNCA mexem em timestamp/last_activity_at (a lista
 * ordena por eles); só reescrevemos a prévia quando a mensagem é a última.
 */
export function camposDaConversaAoAtualizar(conv: Conversation, msg: Message): Conversation | null {
  if (msg.message_type === 'activity') return null;
  const ultima = conv.last_non_activity_message;
  if (!ultima || String(ultima.id) !== String(msg.id)) return null;
  return {
    ...conv,
    last_non_activity_message: {
      ...ultima,
      content: msg.content ?? '',
      message_type: msg.message_type,
      processed_message_content:
        (msg as { processed_message_content?: string }).processed_message_content ?? msg.content ?? '',
      sender: msg.sender ?? ultima.sender,
    },
  };
}

/**
 * Decisão do onMessageCreated: mensagem nova de verdade (entrada/saída) move a
 * conversa; atividade ("marcou etiqueta", "transferiu") entra na thread mas não
 * mexe em timestamp, last_activity_at nem na prévia.
 */
export function camposDaConversaAoCriar(conv: Conversation, msg: Message, timestampSeg: number): Conversation {
  if (msg.message_type === 'activity') return conv;
  return {
    ...conv,
    timestamp: timestampSeg,
    last_activity_at: new Date(timestampSeg * 1000).toISOString(),
    last_non_activity_message: {
      id: msg.id,
      content: msg.content ?? '',
      message_type: msg.message_type,
      created_at:
        typeof msg.created_at === 'number'
          ? String(msg.created_at)
          : (msg.created_at ?? new Date(timestampSeg * 1000).toISOString()),
      processed_message_content:
        (msg as { processed_message_content?: string }).processed_message_content ?? msg.content ?? '',
      sender: msg.sender ?? { id: '', name: '', type: 'contact' },
    },
  };
}
