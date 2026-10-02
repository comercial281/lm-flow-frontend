import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContactSidebar from './ContactSidebar';

// O painel do lead em seções (Fase 4, 02/10): o que saiu não volta, e o que é
// do dia a dia (funil, etiquetas, notas) aparece sem clicar. Com a oferta da
// roleta aberta para quem vê, o telefone vem mascarado e o e-mail some.

const getContactConversations = vi.fn();
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: {
    getContactNotes: () => Promise.resolve({ data: [] }),
    createContactNote: vi.fn(),
    getContactConversations: (...a: unknown[]) => getContactConversations(...a),
    updateContact: vi.fn(),
  },
}));

const getPipelinesByConversation = vi.fn();
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getPipelinesByConversation: (...a: unknown[]) => getPipelinesByConversation(...a),
    moveItem: vi.fn(),
  },
}));

vi.mock('@/services/chat/chatService', () => ({
  chatService: { getSalesAgentStatus: () => Promise.reject(new Error('sem IA')) },
}));

// A lista de números da tela: o nome que o gestor deu ao número é o display_name.
vi.mock('@/features/numbers/useNumerosDaConversa', () => ({
  useNumerosDaConversa: () => ({
    inboxes: [{ id: 'i2', name: 'whatsapp-marina-imoveis', display_name: 'Marina' }],
    numeros: null,
  }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/chat/useConversations', () => ({
  useConversations: () => ({ updateContactInConversations: vi.fn() }),
}));

vi.mock('@/components/contacts/ContactModal', () => ({ default: () => null }));
vi.mock('@/components/chat/contact/ContactAvatar', () => ({ default: () => <div /> }));
vi.mock('@/components/capi/CapiConversionPanel', () => ({ default: () => null }));
vi.mock('@/components/pipelines/EditItemModal', () => ({ default: () => null }));
vi.mock('./PipelineManagement', () => ({ default: () => null }));
vi.mock('./ContactTagsManager', () => ({ default: () => <div>gerenciador-de-etiquetas</div> }));

const contact = {
  id: 'contato-1',
  name: 'Lead Fictício',
  phone_number: '+5511912345634',
  email: 'lead.ficticio@exemplo.com',
  custom_attributes: {},
  additional_attributes: {},
} as never;

const conversation = {
  id: 'conv-1',
  status: 'open',
  assignee_id: null,
  additional_attributes: { ad_referral: { source_app: 'instagram', source_url: 'https://instagram.com/p/exemplo' } },
  custom_attributes: {},
} as never;

const renderPainel = (emOferta = false, contato: unknown = contact) =>
  render(
    <MemoryRouter>
      <ContactSidebar
        isOpen
        onClose={vi.fn()}
        contact={contato as never}
        conversation={conversation}
        emOferta={emOferta}
      />
    </MemoryRouter>,
  );

describe('ContactSidebar — painel do lead em seções', () => {
  beforeEach(() => {
    getPipelinesByConversation.mockReset();
    getContactConversations.mockReset();
    getPipelinesByConversation.mockResolvedValue([]);
    getContactConversations.mockResolvedValue({ data: [] });
  });

  it('os cards que saíram não aparecem', async () => {
    renderPainel();
    await waitFor(() => expect(getPipelinesByConversation).toHaveBeenCalledWith('conv-1'));

    for (const texto of [
      /Nome do atendente/i,
      /Informações da conversa/i,
      /Origem do Anúncio/i,
      /Conversas anteriores/i,
      /Excluir contato/i,
      /Online/i,
    ]) {
      expect(screen.queryByText(texto)).toBeNull();
    }
  });

  it('funil, etiquetas e notas à vista, sem clicar', async () => {
    renderPainel();
    expect(await screen.findByText('Colocar no funil')).toBeTruthy();
    expect(screen.getByText('Funil')).toBeTruthy();
    expect(screen.getByText('Etiquetas')).toBeTruthy();
    expect(screen.getByText('gerenciador-de-etiquetas')).toBeTruthy();
    expect(screen.getByText('Notas')).toBeTruthy();
  });

  it('topo: telefone inteiro, e-mail, "Veio de" com o anúncio e o lápis de editar', async () => {
    renderPainel();
    expect(screen.getByText('(11) 91234-5634')).toBeTruthy();
    expect(screen.getByText('lead.ficticio@exemplo.com')).toBeTruthy();
    expect(screen.getByText('Anúncio no Instagram')).toBeTruthy();
    expect(screen.getByText('Ver anúncio').closest('a')?.getAttribute('href')).toBe('https://instagram.com/p/exemplo');
    expect(screen.getByLabelText('Editar contato')).toBeTruthy();
    expect(screen.getByLabelText('Copiar telefone')).toBeTruthy();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
  });

  it('com a oferta da roleta aberta: telefone mascarado, sem e-mail e sem copiar', async () => {
    renderPainel(true);
    expect(screen.getByText('(11) •••••-••34')).toBeTruthy();
    expect(screen.queryByText('(11) 91234-5634')).toBeNull();
    expect(screen.queryByText('lead.ficticio@exemplo.com')).toBeNull();
    expect(screen.queryByLabelText('Copiar telefone')).toBeNull();
    expect(screen.queryByLabelText('Editar contato')).toBeNull();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
  });

  it('outra conversa do lead: "Também conversou pelo número" (nome do gestor) com o atalho', async () => {
    getContactConversations.mockResolvedValue({
      data: [
        { id: 'conv-1', inbox: { id: 'i1', name: 'Plantão' }, last_activity_at: 1_790_000_900 },
        { id: 'conv-2', inbox: { id: 'i2', name: 'whatsapp-marina-imoveis' }, last_activity_at: 1_790_000_500 },
      ],
    });
    renderPainel();
    expect(await screen.findByText(/Também conversou pelo número Marina/)).toBeTruthy();
    expect(screen.getByText('abrir')).toBeTruthy();
  });

  it('Respostas do formulário: aparecem fora da oferta e somem com a oferta aberta', async () => {
    const comFormulario = { ...(contact as object), custom_attributes: { telefone_alternativo: '11 98888-7777' } };

    const { unmount } = renderPainel(false, comFormulario);
    expect(screen.getByText('Respostas do formulário')).toBeTruthy();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
    unmount();

    renderPainel(true, comFormulario);
    expect(screen.queryByText('Respostas do formulário')).toBeNull();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalledTimes(2));
  });

  it('oferta aberta: "Abrir card do lead" some (o card mostra telefone e e-mail); sem oferta, aparece', async () => {
    const comItem = [
      {
        id: 'funil-1',
        name: 'Funil de vendas',
        stages: [
          {
            id: 'etapa-1',
            name: 'Novo lead',
            position: 0,
            items: [{ id: 'item-1', item_id: 'conv-1', pipeline_id: 'funil-1', stage_id: 'etapa-1' }],
          },
        ],
      },
    ];
    getPipelinesByConversation.mockResolvedValue(comItem);

    const { unmount } = renderPainel(false);
    expect(await screen.findByText('Abrir card do lead')).toBeTruthy();
    unmount();

    renderPainel(true);
    expect(await screen.findByText('Funil de vendas · Etapa')).toBeTruthy();
    expect(screen.queryByText('Abrir card do lead')).toBeNull();
  });

  it('oferta aberta: nome que é o telefone sai mascarado no topo', async () => {
    renderPainel(true, { ...(contact as object), name: '+5511912345634' });
    // O nome e o telefone: os dois mascarados, nenhum inteiro.
    expect(screen.getAllByText('(11) •••••-••34')).toHaveLength(2);
    expect(screen.queryByText('+5511912345634')).toBeNull();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
  });
});
