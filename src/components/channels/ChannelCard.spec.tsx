import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelCard from './ChannelCard';
import { Inbox } from '@/types/channels/inbox';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const canal = (status: Inbox['connection_status']) =>
  ({
    id: '7',
    name: 'bernardo',
    channel_type: 'Channel::Whatsapp',
    provider: 'evolution',
    connection_status: status,
  }) as unknown as Inbox;

// Atendentes, horário, nome e o resto das configurações não dependem de o número
// estar no ar — quem grava isso é o CRM, não o WhatsApp. O card do número caído
// só oferecia "Reconectar", e isso fazia parecer que não havia mais nada a fazer
// ali até alguém ler o QR Code.
describe('ChannelCard', () => {
  it('oferece Reconectar E Configurar quando o número está fora do ar', () => {
    render(<ChannelCard inbox={canal('disconnected')} onSettings={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole('button', { name: /actions\.reconnect/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.configure/ })).toBeInTheDocument();
  });

  it('leva direto ao QR Code pelo Reconectar', async () => {
    const abrir = vi.fn();
    render(<ChannelCard inbox={canal('disconnected')} onSettings={abrir} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /actions\.reconnect/ }));

    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }), 'configuration');
  });

  it('abre as configurações básicas pelo Configurar, sem aba pedida', async () => {
    const abrir = vi.fn();
    render(<ChannelCard inbox={canal('disconnected')} onSettings={abrir} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /actions\.configure/ }));

    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }));
  });

  it('não oferece Reconectar no número que está no ar', () => {
    render(<ChannelCard inbox={canal('connected')} onSettings={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /actions\.reconnect/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.configure/ })).toBeInTheDocument();
  });

  // Desde 04/09/2026 o corretor vê nesta lista os números em que ATENDE, para
  // acompanhar o estado e religar. Excluir canal continua sendo do gestor —
  // mostrar a lixeira a ele seria um botão vermelho que só sabe recusar.
  it('esconde a lixeira de quem não pode excluir canal', () => {
    render(
      <ChannelCard inbox={canal('connected')} onSettings={vi.fn()} onDelete={vi.fn()} canDelete={false} />,
    );

    expect(screen.getByRole('button', { name: /actions\.configure/ })).toBeInTheDocument();
    // A lixeira é o único botão sem rótulo de texto do card.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
