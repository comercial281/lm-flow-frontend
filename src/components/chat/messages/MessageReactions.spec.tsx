import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageReactions, { readReactions } from './MessageReactions';
import type { Message } from '@/types/chat/api';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (_key: string, padrao?: string) => padrao ?? _key }),
}));

// O selo de curtida mora DENTRO da mensagem, porque quem atualiza mensagem no
// chat substitui o objeto inteiro. Guardar a curtida em estado da tela faria
// ela sumir no primeiro "entregue → lida".
function mensagem(reactions?: unknown): Message {
  return {
    id: 1,
    content: 'Bom dia!',
    content_attributes: reactions === undefined ? {} : { reactions },
    content_type: 'text',
    conversation_id: 1,
    created_at: 0,
    message_type: 'outgoing',
    private: false,
    source_id: 'WA-1',
  } as unknown as Message;
}

describe('MessageReactions', () => {
  it('mostra o emoji que grudou na mensagem', () => {
    render(<MessageReactions message={mensagem([{ emoji: '👍', actor: 'contact' }])} />);

    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('diz quem curtiu, pro corretor separar a IA do cliente', () => {
    render(<MessageReactions message={mensagem([{ emoji: '🙏', actor: 'agent' }])} />);

    expect(screen.getByTitle('Curtido pela IA')).toBeInTheDocument();
  });

  it('mostra lado a lado as curtidas de quem for', () => {
    render(
      <MessageReactions
        message={mensagem([
          { emoji: '👍', actor: 'contact' },
          { emoji: '🔥', actor: 'agent' },
        ])}
      />,
    );

    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('não desenha nada na mensagem sem curtida', () => {
    const { container } = render(<MessageReactions message={mensagem()} />);

    expect(container).toBeEmptyDOMElement();
  });

  // `content_attributes` é um mapa aberto que vem do servidor: formato
  // inesperado não pode derrubar a conversa inteira.
  it('aguenta formato estranho sem quebrar a conversa', () => {
    expect(readReactions(mensagem('nao é lista'))).toEqual([]);
    expect(readReactions(mensagem([{ actor: 'contact' }]))).toEqual([]);
    expect(readReactions(mensagem([null]))).toEqual([]);
  });
});
