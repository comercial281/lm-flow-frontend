import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render as renderRtl, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CardDoContato from './CardDoContato';

// No celular o card navega pra página (useNavigate): precisa do roteador.
const render = (ui: ReactElement) => renderRtl(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

function noCelular() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 767px)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

function Endereco() {
  const l = useLocation();
  return <span data-testid="endereco">{l.pathname}|{JSON.stringify(l.state)}</span>;
}

function montarComRotas(ui: ReactElement, inicio = '/contacts') {
  return renderRtl(
    <MemoryRouter initialEntries={['/antes', inicio]} initialIndex={1}>
      <Routes>
        <Route path="/contacts/*" element={ui} />
        <Route path="/pipelines/:p/card/:i" element={<Endereco />} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  default: (p: { item: { id: string; status?: string; whatsapp_conversation_id?: string }; cabecalho?: React.ReactNode; onColocadoNoFunil?: () => void; onItemStatusChanged?: (i: unknown) => void; onOpenChange?: (o: boolean) => void }) => (
    <div>
      {p.onItemStatusChanged && <button onClick={() => p.onItemStatusChanged?.({ id: p.item.id, status: 'won' })}>ganhou</button>}
      <button onClick={() => p.onOpenChange?.(false)}>fechar</button>
      {p.cabecalho}
      <span data-testid="card">{p.item.id || 'sem-funil'}</span>
      <span data-testid="status">{p.item.status ?? 'open'}</span>
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

  it('Ganho dado na janela: avisa que mudou e a lista guarda o card fechado', async () => {
    servicos.porContato.mockResolvedValue([funil('p1', 'Venda', 'i1', 1)]);
    const onMudou = vi.fn();
    render(<CardDoContato contactId="c1" onOpenChange={vi.fn()} onMudou={onMudou} />);
    await screen.findByTestId('card');
    fireEvent.click(screen.getByText('ganhou'));
    expect(screen.getByTestId('status')).toHaveTextContent('won');
    fireEvent.click(screen.getByText('fechar'));
    expect(onMudou).toHaveBeenCalledTimes(1);
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

  describe('no celular', () => {
    let devolver: () => void;
    beforeEach(() => { devolver = noCelular(); });
    afterEach(() => devolver());

    it('em um funil só: vai pra página do card, sem a janela', async () => {
      servicos.porContato.mockResolvedValue([funil('p1', 'Venda', 'i1', 1)]);
      montarComRotas(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

      expect(await screen.findByTestId('endereco')).toHaveTextContent('/pipelines/p1/card/i1|{"voltarPeloHistorico":true}');
      expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });

    it('em dois funis: pergunta qual e abre a página do escolhido', async () => {
      servicos.porContato.mockResolvedValue([funil('p1', 'Venda', 'i1', 1), funil('p2', 'Locação', 'i2', 9)]);
      montarComRotas(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

      expect(await screen.findByText('Abrir o card de qual funil?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Venda/ }));
      expect(await screen.findByTestId('endereco')).toHaveTextContent('/pipelines/p1/card/i1');
    });

    it('sem funil: continua na janela (a página precisa de um funil)', async () => {
      servicos.porContato.mockResolvedValue([]);
      servicos.contato.mockResolvedValue({ id: 'c1', name: 'Ana' });
      servicos.conversas.mockResolvedValue({ data: [] });
      montarComRotas(<CardDoContato contactId="c1" onOpenChange={vi.fn()} />);

      expect(await screen.findByTestId('card')).toHaveTextContent('sem-funil');
    });
  });
});
