import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import type { Message } from '@/types/chat/api';

/**
 * O selo de reação ("curtida") que fica grudado na bolha, como no WhatsApp.
 *
 * A reação NÃO é uma mensagem — ela mora dentro da mensagem ALVO, em
 * `content_attributes.reactions`, gravada pelo servidor. Isso é de propósito e
 * não é detalhe: o reducer que atualiza mensagem no chat SUBSTITUI o objeto
 * inteiro (só preserva o tipo e o autor de mensagens de saída), então qualquer
 * estado de reação guardado aqui na tela seria apagado no primeiro
 * "entregue → lida". Vindo dentro da mensagem, ela sobrevive.
 *
 * Por isso também: nada de estado local, nada de curtida otimista. Quem manda é
 * o servidor.
 */

type Reaction = {
  emoji?: unknown;
  actor?: unknown;
  actor_id?: unknown;
};

/** Lê as reações da mensagem sem confiar no formato — `content_attributes` é um mapa aberto. */
export function readReactions(message: Message): { emoji: string; actor: string }[] {
  const raw = (message.content_attributes as Record<string, unknown> | undefined)?.reactions;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const r = (item ?? {}) as Reaction;
      return { emoji: String(r.emoji ?? '').trim(), actor: String(r.actor ?? '') };
    })
    .filter((r) => r.emoji.length > 0);
}

interface MessageReactionsProps {
  message: Message;
  /** Alinha o selo pelo lado da bolha a que ele pertence. */
  isOwn?: boolean;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({ message, isOwn = false }) => {
  const { t } = useLanguage('chat');
  const reactions = readReactions(message);

  if (reactions.length === 0) return null;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} -mt-1.5`}>
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 shadow-sm">
        {reactions.map((reaction, index) => (
          <span
            key={`${reaction.actor}-${index}`}
            className="text-sm leading-none"
            /* Quem reagiu importa para o corretor entender se foi a IA ou o lead. */
            title={
              reaction.actor === 'agent'
                ? t('messages.reactions.byAgent', 'Curtido pela IA')
                : reaction.actor === 'contact'
                  ? t('messages.reactions.byContact', 'Curtido pelo cliente')
                  : t('messages.reactions.byUser', 'Curtido pela equipe')
            }
          >
            {reaction.emoji}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MessageReactions;
