import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardDoContato from './CardDoContato';

// O card da pessoa (spec 2026-10-02-fase-4-card-do-contato): um atendimento →
// o card direto; vários → abinhas no topo; nenhum → card sem funil.

const servicos = vi.hoisted(() => ({
  porContato: vi.fn(),
  contato: vi.fn(),
  conversas: vi.fn(),
}));

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelinesByContact: servicos.porContato },
}));
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: { getContact: servicos.contato, getContactConversations: servicos.conversas },
}));
// O card de verdade tem a própria bateria; aqui interessa o que ele recebe.
vi.mock('@/components/pipelines/EditItemModal', () => ({
  default: (p: { item: { id: string; whatsapp_conversation_id?: string }; cabecalho?: React.ReactNode; onColocadoNoFunil?: () => void }) => (
    <div>
      {p.cabecalho}
      <span data-testid="card">{p.item.id || 'sem-funil'}</span>
      {p.item.whatsapp_conversation_id && <span data-testid="conversa">{p.item.whatsapp_conversation_id}</span>}
      {p.onColocadoNoFunil && <span>colocar no funil</span>}
    </div>
  ),
}));

const funil = (id: string, name: string, itemId: string, updated: number) => ({
  id, name, stages: [{ id: `${id}-s1`, name: 'Novo', color: '#f00', position: 1, items: [{ id: itemId, updated_at: updated }] }],
});

beforeEach(() => {
  servicos.porContato.mockReset();
  servicos.contato.mockReset();
  servicos.conversas.mockReset();
});

describe('CardDoContato', () => {
  it('em um funil só: abre o card daquele atendimento, sem abinhas', async () => {
    servicos.porContato.mockResolvedValue([funil('p1', 'Venda', 'i1', 1)]);
    render(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

    expect(await screen.findByTestId('card')).toHaveTextContent('i1');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('em dois funis: abinhas no topo, abre o mais recente e troca ao clicar', async () => {
    servicos.porContato.mockResolvedValue([funil('p1', 'Venda', 'i1', 1), funil('p2', 'Locação', 'i2', 9)]);
    render(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

    expect(await screen.findByTestId('card')).toHaveTextContent('i2');
    fireEvent.click(screen.getByRole('tab', { name: /Venda/ }));
    expect(screen.getByTestId('card')).toHaveTextContent('i1');
  });

  it('sem funil: card do próprio contato, com a última conversa e o "Colocar no funil"', async () => {
    servicos.porContato.mockResolvedValue([]);
    servicos.contato.mockResolvedValue({ id: 'c1', name: 'Ana', additional_attributes: {} });
    servicos.conversas.mockResolvedValue({ data: [{ id: 55 }] });
    render(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

    expect(await screen.findByTestId('card')).toHaveTextContent('sem-funil');
    expect(screen.getByTestId('conversa')).toHaveTextContent('55');
    expect(screen.getByText('colocar no funil')).toBeInTheDocument();
  });
});
