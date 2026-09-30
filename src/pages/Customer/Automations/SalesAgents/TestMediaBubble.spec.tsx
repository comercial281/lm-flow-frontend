import { render, screen } from '@testing-library/react';
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
          title: 'Fotos do imóvel Alma Panamby - AP123 (7 fotos, 0 já enviadas)',
          caption: 'Alma Panamby — R$ 450.000',
          reason: 'apresentou o imóvel',
          urls: ['https://cdn.exemplo/1.jpg', 'https://cdn.exemplo/2.jpg', 'https://cdn.exemplo/3.jpg'],
        }}
      />,
    );

    const fotos = screen.getAllByRole('img');
    expect(fotos).toHaveLength(3);
    expect(fotos[0]).toHaveAttribute('src', 'https://cdn.exemplo/1.jpg');
    expect(screen.getByText('3 fotos enviadas no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Alma Panamby — R$ 450.000')).toBeInTheDocument();
    expect(screen.getByText(/apresentou o imóvel/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('mostra o vídeo como vídeo, não como arquivo', () => {
    render(<TestMediaBubble item={{ type: 'file', kind: 'video', title: 'Vídeo do imóvel Alma Panamby' }} />);

    expect(screen.getByText('Vídeo enviado no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Vídeo do imóvel Alma Panamby')).toBeInTheDocument();
  });

  it('arquivo comum continua como arquivo', () => {
    render(<TestMediaBubble item={{ type: 'file', kind: 'document', title: 'Planta' }} />);

    expect(screen.getByText('Arquivo enviado no WhatsApp')).toBeInTheDocument();
  });
});
