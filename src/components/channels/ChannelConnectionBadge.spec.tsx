import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChannelConnectionBadge from './ChannelConnectionBadge';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

// O selo responde "essa instância está no ar?" direto no card da tela de Canais.
// O que ele NÃO pode fazer é responder quando não sabe: canal sem sessão (Cloud
// API, e-mail, widget) não tem instância pra cair, e um selo ali mandaria a
// pessoa procurar defeito onde não existe.
describe('ChannelConnectionBadge', () => {
  it('mostra a instância conectada', () => {
    render(<ChannelConnectionBadge status="connected" />);

    expect(screen.getByText('card.connection.connected')).toBeInTheDocument();
  });

  it('mostra a instância caída', () => {
    render(<ChannelConnectionBadge status="disconnected" />);

    expect(screen.getByText('card.connection.disconnected')).toBeInTheDocument();
  });

  it('mostra o pareamento em andamento', () => {
    render(<ChannelConnectionBadge status="connecting" />);

    expect(screen.getByText('card.connection.connecting')).toBeInTheDocument();
  });

  it('não desenha nada para canal que não mantém sessão', () => {
    const { container } = render(<ChannelConnectionBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('diz desde quando a instância está fora do ar', () => {
    render(<ChannelConnectionBadge status="disconnected" disconnectedAt="2026-08-14T12:32:00Z" />);

    expect(screen.getByText(/card\.connection\.since/)).toBeInTheDocument();
  });

  it('não anuncia queda antiga num canal que voltou', () => {
    render(<ChannelConnectionBadge status="connected" disconnectedAt="2026-08-14T12:32:00Z" />);

    expect(screen.queryByText(/card\.connection\.since/)).not.toBeInTheDocument();
  });

  // Data quebrada aparecia como "Invalid Date" no meio do card.
  it('omite a data quando ela não dá pra ler', () => {
    render(<ChannelConnectionBadge status="disconnected" disconnectedAt="nao-e-data" />);

    expect(screen.queryByText(/card\.connection\.since/)).not.toBeInTheDocument();
  });

  it('não mostra a data na versão da lista', () => {
    render(
      <ChannelConnectionBadge status="disconnected" disconnectedAt="2026-08-14T12:32:00Z" variant="compact" />,
    );

    expect(screen.getByText('card.connection.disconnected')).toBeInTheDocument();
    expect(screen.queryByText(/card\.connection\.since/)).not.toBeInTheDocument();
  });
});
