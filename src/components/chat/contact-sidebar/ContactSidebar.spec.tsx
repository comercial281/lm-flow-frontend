import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContactSidebar from './ContactSidebar';

// O painel do lead em seções (Fase 4, 02/10): o que saiu não volta, e o que é
// do dia a dia (funil, etiquetas, notas) aparece sem clicar. Com a oferta da
// roleta aberta para quem vê, o telefone vem mascarado e o e-mail some.
// Proposta B (02/10): faixa de selos logo abaixo do nome, Conversão Meta numa
// linha logo abaixo, Etiquetas só com as do lead e o resumo da IA à vista.

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

vi.mock('@/services/chat/chatService', () => {
  const servico = {
    getSalesAgentStatus: () => Promise.reject(new Error('sem IA')),
    addLabels: vi.fn(),
    removeLabels: vi.fn(),
  };
  return { chatService: servico, default: servico };
});

// O catálogo de etiquetas da conta (vem do store, que busca uma vez).
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: {
    getLabels: () =>
      Promise.resolve({
        data: [
          { id: 'l1', title: 'zona sul', color: '#2563eb' },
          { id: 'l2', title: 'visita-agendada', color: '#16a34a' },
        ],
      }),
    createLabel: vi.fn(),
  },
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
vi.mock('@/components/capi/CapiConversionPanel', () => ({
  default: ({ variante }: { variante?: string }) => <div data-testid="conversao-meta">{variante}</div>,
}));
vi.mock('@/components/pipelines/EditItemModal', () => ({ default: () => null }));
vi.mock('./PipelineManagement', () => ({ default: () => null }));

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

const renderPainel = (emOferta = false, contato: unknown = contact, conversa: unknown = conversation) =>
  render(
    <MemoryRouter>
      <ContactSidebar
        isOpen
        onClose={vi.fn()}
        contact={contato as never}
        conversation={conversa as never}
        emOferta={emOferta}
      />
    </MemoryRouter>,
  );

// Lead no funil, com a IA dizendo "quente" e esperando resposta há 2 h.
const funilComOLead = [
  {
    id: 'funil-1',
    name: 'Funil de vendas',
    stages: [
      { id: 'etapa-0', name: 'Novo lead', color: '#2563eb', position: 0, items: [] },
      {
        id: 'etapa-1',
        name: 'Primeiro contato',
        color: '#16a34a',
        position: 1,
        items: [{ id: 'item-1', item_id: 'conv-1', pipeline_id: 'funil-1', stage_id: 'etapa-1' }],
      },
    ],
  },
];
const conversaQuenteEsperando = () => ({
  ...(conversation as object),
  additional_attributes: {
    ad_referral: { source_app: 'instagram', source_url: 'https://instagram.com/p/exemplo' },
    sales_agent_temperature: 'hot',
  },
  waiting_since: Math.floor(Date.now() / 1000) - 2 * 3600,
  last_non_activity_message: { id: 'm1', message_type: 0, content: 'oi', created_at: '' },
});

const segue = (antes: Element, depois: Element) =>
  Boolean(antes.compareDocumentPosition(depois) & Node.DOCUMENT_POSITION_FOLLOWING);

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
    expect(screen.getByRole('button', { name: '+ Etiqueta' })).toBeTruthy();
    expect(screen.getByText('Notas')).toBeTruthy();
  });

  it('topo: telefone inteiro, e-mail, a origem como selo que leva ao anúncio e o lápis de editar', async () => {
    renderPainel();
    expect(screen.getByText('(11) 91234-5634')).toBeTruthy();
    expect(screen.getByText('lead.ficticio@exemplo.com')).toBeTruthy();
    const origem = screen.getByText('Anúncio no Instagram').closest('a');
    expect(origem?.getAttribute('href')).toBe('https://instagram.com/p/exemplo');
    expect(origem?.getAttribute('title')).toBe('Ver anúncio');
    // A linha de texto "Veio de: ..." saiu: a origem é o selo.
    expect(screen.queryByText(/Veio de/)).toBeNull();
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
  it('ordem: topo → selos → Conversão Meta (compacta) → Funil → Etiquetas → Notas', async () => {
    getPipelinesByConversation.mockResolvedValue(funilComOLead);
    renderPainel(false, contact, conversaQuenteEsperando());

    const selos = await screen.findByRole('group', { name: 'Resumo do lead' });
    expect(await within(selos).findByText('Primeiro contato')).toBeTruthy();
    expect(within(selos).getByText('Quente')).toBeTruthy();
    expect(within(selos).getByText('Anúncio no Instagram')).toBeTruthy();
    expect(within(selos).getByText('sem resposta há 2 h')).toBeTruthy();

    const nome = screen.getByRole('heading', { name: 'Lead Fictício' });
    const meta = screen.getByTestId('conversao-meta');
    expect(meta.textContent).toBe('compacto');
    const funil = screen.getByRole('region', { name: 'Funil' });
    const etiquetas = screen.getByRole('region', { name: 'Etiquetas' });
    const notas = screen.getByRole('region', { name: 'Notas' });

    expect(segue(nome, selos)).toBe(true);
    expect(segue(selos, meta)).toBe(true);
    expect(segue(meta, funil)).toBe(true);
    expect(segue(funil, etiquetas)).toBe(true);
    expect(segue(etiquetas, notas)).toBe(true);
  });

  it('lead fora de funil, sem IA e sem espera: só o selo da origem', async () => {
    renderPainel();
    const selos = await screen.findByRole('group', { name: 'Resumo do lead' });
    await waitFor(() => expect(getPipelinesByConversation).toHaveBeenCalled());
    expect(within(selos).getAllByText(/./).map(el => el.textContent)).toEqual(['Anúncio no Instagram']);
  });

  it('Etiquetas: só as do lead; o catálogo da conta só aparece no "+ Etiqueta"', async () => {
    renderPainel(false, { ...(contact as object), labels: [{ name: 'zona sul', color: '#2563eb' }] });
    const etiquetas = screen.getByRole('region', { name: 'Etiquetas' });
    expect(within(etiquetas).getByText('zona sul')).toBeTruthy();
    expect(within(etiquetas).queryByText('visita-agendada')).toBeNull();
    expect(within(etiquetas).queryByText('Nenhuma etiqueta')).toBeNull();

    fireEvent.click(within(etiquetas).getByRole('button', { name: '+ Etiqueta' }));
    expect(await within(etiquetas).findByRole('button', { name: 'visita-agendada' })).toBeTruthy();
  });

  it('O que a IA entendeu: o resumo aparece sem clicar; a temperatura fica no selo', async () => {
    const comResumo = {
      ...conversaQuenteEsperando(),
      additional_attributes: {
        sales_agent_temperature: 'warm',
        sales_agent_summary: 'Procura 2 dormitórios na zona sul, até R$ 450 mil.',
      },
    };
    renderPainel(false, contact, comResumo);
    const ia = screen.getByRole('region', { name: 'O que a IA entendeu' });
    expect(within(ia).getByText('Procura 2 dormitórios na zona sul, até R$ 450 mil.')).toBeTruthy();
    expect(within(ia).queryByText('Morno')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Resumo do lead' })).getByText('Morno')).toBeTruthy();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
  });

  it('IA só com a temperatura: a seção não aparece (a temperatura já está no selo)', async () => {
    renderPainel(false, contact, conversaQuenteEsperando());
    expect(within(screen.getByRole('group', { name: 'Resumo do lead' })).getByText('Quente')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'O que a IA entendeu' })).toBeNull();
    await waitFor(() => expect(getContactConversations).toHaveBeenCalled());
  });

  it('oferta aberta: os selos aparecem e o telefone segue mascarado', async () => {
    getPipelinesByConversation.mockResolvedValue(funilComOLead);
    renderPainel(true, contact, conversaQuenteEsperando());

    const selos = await screen.findByRole('group', { name: 'Resumo do lead' });
    expect(await within(selos).findByText('Primeiro contato')).toBeTruthy();
    expect(within(selos).getByText('Quente')).toBeTruthy();
    expect(within(selos).getByText('Anúncio no Instagram')).toBeTruthy();
    expect(within(selos).getByText('sem resposta há 2 h')).toBeTruthy();

    expect(screen.getByText('(11) •••••-••34')).toBeTruthy();
    expect(screen.queryByText('(11) 91234-5634')).toBeNull();
    expect(screen.queryByText('lead.ficticio@exemplo.com')).toBeNull();
  });
});
