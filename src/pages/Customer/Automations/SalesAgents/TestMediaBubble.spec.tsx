import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TestMediaBubble from './TestMediaBubble';

// O painel Testar é onde o dono confere, sem lead de verdade, QUAIS fotos a IA
// mandaria de cada imóvel (29/09/26). Ele tem que mostrar as fotos do pacote,
// todas, na ordem em que iriam — e nada de link.
describe('TestMediaBubble', () => {
  it('mostra todas as fotos do pacote, a legenda e o motivo', () => {
    render(
      <TestMediaBubble
        item={{
          type: 'photos',
          title: 'Fotos do imóvel Residencial Exemplo - AP123 (7 fotos, 0 já enviadas)',
          caption: 'Residencial Exemplo — R$ 450.000',
          reason: 'apresentou o imóvel',
          urls: ['https://cdn.exemplo/1.jpg', 'https://cdn.exemplo/2.jpg', 'https://cdn.exemplo/3.jpg'],
        }}
      />,
    );

    const fotos = screen.getAllByRole('img');
    expect(fotos).toHaveLength(3);
    expect(fotos[0]).toHaveAttribute('src', 'https://cdn.exemplo/1.jpg');
    expect(screen.getByText('3 fotos enviadas no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Residencial Exemplo — R$ 450.000')).toBeInTheDocument();
    expect(screen.getByText(/apresentou o imóvel/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('mostra o vídeo como vídeo, não como arquivo', () => {
    render(<TestMediaBubble item={{ type: 'file', kind: 'video', title: 'Vídeo do imóvel Residencial Exemplo' }} />);

    expect(screen.getByText('Vídeo enviado no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Vídeo do imóvel Residencial Exemplo')).toBeInTheDocument();
  });

  it('arquivo comum continua como arquivo', () => {
    render(<TestMediaBubble item={{ type: 'file', kind: 'document', title: 'Planta' }} />);

    expect(screen.getByText('Arquivo enviado no WhatsApp')).toBeInTheDocument();
  });

  // "Mandar pra mim" (30/09/26): o dono confere no próprio WhatsApp como a
  // mídia chega de verdade. Só aparece quando dá pra identificar a mídia
  // (token) e o handler foi passado — sem isso não tem o que mandar.
  it('mostra "Mandar pra mim" numa foto com token e handler', () => {
    const onSendToMe = vi.fn().mockResolvedValue('Mandado!');
    render(
      <TestMediaBubble
        item={{ type: 'photos', token: 'tok-1', urls: ['https://cdn.exemplo/1.jpg'] }}
        onSendToMe={onSendToMe}
      />,
    );

    expect(screen.getByRole('button', { name: /mandar pra mim/i })).toBeInTheDocument();
  });

  it('esconde "Mandar pra mim" sem token, mesmo com handler', () => {
    const onSendToMe = vi.fn().mockResolvedValue('Mandado!');
    render(
      <TestMediaBubble
        item={{ type: 'photos', urls: ['https://cdn.exemplo/1.jpg'] }}
        onSendToMe={onSendToMe}
      />,
    );

    expect(screen.queryByRole('button', { name: /mandar pra mim/i })).toBeNull();
  });

  it('esconde "Mandar pra mim" sem handler, mesmo com token', () => {
    render(
      <TestMediaBubble item={{ type: 'photos', token: 'tok-1', urls: ['https://cdn.exemplo/1.jpg'] }} />,
    );

    expect(screen.queryByRole('button', { name: /mandar pra mim/i })).toBeNull();
  });

  it('mostra "Mandar pra mim" num arquivo com token', () => {
    const onSendToMe = vi.fn().mockResolvedValue('Mandado!');
    render(
      <TestMediaBubble item={{ type: 'file', kind: 'document', title: 'Planta', token: 'tok-2' }} onSendToMe={onSendToMe} />,
    );

    expect(screen.getByRole('button', { name: /mandar pra mim/i })).toBeInTheDocument();
  });

  it('link não ganha "Mandar pra mim" mesmo com token', () => {
    const onSendToMe = vi.fn().mockResolvedValue('Mandado!');
    render(<TestMediaBubble item={{ type: 'link', url: 'https://x.com', token: 'tok-3' }} onSendToMe={onSendToMe} />);

    expect(screen.queryByRole('button', { name: /mandar pra mim/i })).toBeNull();
  });
});
