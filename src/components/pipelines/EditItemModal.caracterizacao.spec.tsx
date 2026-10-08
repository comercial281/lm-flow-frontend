// src/components/pipelines/EditItemModal.caracterizacao.spec.tsx
// Rede da E4 (spec do funil §5.2/§5.4): a janela do card NÃO muda de cara
// quando o estado sai para useCardDoLead e o desenho sai para os blocos.
// Escrito ANTES da extração, contra a janela como está; passa igual depois.
// Quem falhar aqui depois da extração mudou a janela: conserte a extração.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EditItemModal from './EditItemModal';

const s = vi.hoisted(() => ({
  moveItem: vi.fn(),
  assignConversation: vi.fn(),
  addLabels: vi.fn(),
  removeLabels: vi.fn(),
  getContactEvents: vi.fn(),
  getLabels: vi.fn(),
  createLabel: vi.fn(),
  updateContact: vi.fn(),
  getAll: vi.fn(),
  assign: vi.fn(),
  listForLead: vi.fn(),
  cancelForLead: vi.fn(),
  removeItem: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: s.toastSuccess, error: s.toastError } }));
vi.mock('@/hooks/useAccountUsers', () => ({
  useAccountUsers: () => ({ users: [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }] }),
}));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/hooks/useOpenLeadConversation', () => ({
  useOpenLeadConversation: () => ({ openLeadConversation: vi.fn(), startConversationModal: null, opening: false }),
}));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => null }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true, isReady: true }) }));
vi.mock('@/components/chat/contact/ContactAvatar', () => ({ default: () => <div data-testid="foto" /> }));
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { assignConversation: s.assignConversation, addLabels: s.addLabels, removeLabels: s.removeLabels },
}));
vi.mock('@/services/contacts/contactEventsService', () => ({
  contactEventsService: { getContactEvents: s.getContactEvents },
}));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: s.getLabels, createLabel: s.createLabel },
}));
vi.mock('@/services/contacts/contactsService', () => ({ contactsService: { updateContact: s.updateContact } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { moveItem: s.moveItem, removeItemFromPipeline: s.removeItem, archiveItem: vi.fn(), unarchiveItem: vi.fn() },
}));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: s.getAll, assign: s.assign },
  roletaLabel: (r?: { display_name?: string | null; name?: string | null } | null) => r?.display_name || r?.name || 'Roleta',
}));
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({
  brokerAssignmentsService: { listForLead: s.listForLead, cancelForLead: s.cancelForLead },
}));
vi.mock('@/components/roleta/OfferActions', () => ({ default: () => null }));
vi.mock('@/components/capi/CapiConversionPanel', () => ({
  default: (p: { variante?: string }) => <div data-testid="meta" data-variante={p.variante} />,
}));
vi.mock('@/components/pipelines/FollowupTimeline', () => ({ default: () => <div data-testid="followup" /> }));
vi.mock('@/components/pipelines/card/LeadQuickActions', () => ({
  default: (p: { nomeExibido: string }) => <div data-testid="atalhos">{p.nomeExibido}</div>,
}));
// O rodapé é da Parte 3 (situação, com a própria bateria). O falso imita o que
// importa à janela: gravou → chama onMudou com o card novo (Ganho).
vi.mock('@/components/pipelines/card/CardResultFooter', () => ({
  default: (p: { item: Record<string, unknown>; onMudou?: (i: unknown) => void }) => (
    <button
      type="button"
      data-testid="ganho-perdido"
      onClick={() => p.onMudou?.({ ...p.item, status: 'won', won_at: '2026-10-07T12:00:00Z' })}
    >
      Marcar ganho (falso)
    </button>
  ),
}));
vi.mock('@/components/pipelines/card/ColocarNoFunil', () => ({
  default: (p: { conversationId?: string | null }) => <div data-testid="colocar-no-funil" data-conversa={p.conversationId ?? ''} />,
}));
vi.mock('@/features/tarefas/TarefasDoLead', () => ({
  default: (p: { pipelineItemIds: string[]; criarNoCard: string | null; aoContar?: (r: { abertas: number; atrasadas: number }) => void }) => (
    <button
      type="button"
      data-testid="aba-tarefas"
      data-ids={p.pipelineItemIds.join(',')}
      data-criar={p.criarNoCard ?? ''}
      onClick={() => p.aoContar?.({ abertas: 2, atrasadas: 1 })}
    >
      tarefas
    </button>
  ),
}));
vi.mock('@/components/chat/contact-sidebar/AiUnderstandingPanel', () => ({ default: () => null }));
vi.mock('@/components/pipelines/CardNotesTab', () => ({ default: () => <div data-testid="observacoes" /> }));
vi.mock('@/components/pipelines/CardPropertyInterests', () => ({ default: () => <div data-testid="imoveis" /> }));
vi.mock('@/components/pipelines/card/OutrasInformacoes', () => ({ default: () => null }));
vi.mock('@/components/pipelines/CardConversationTab', () => ({
  default: (p: { item: { id: string; conversation?: { id: number } } }) => (
    <div data-testid="aba-conversa" data-item={p.item.id} data-conversa={p.item.conversation?.id ?? ''} />
  ),
}));
vi.mock('@/components/pipelines/card/JuntarContato', () => ({
  default: (p: { contato: { id: string }; onFechar: () => void }) => (
    <div data-testid="juntar" data-contato={p.contato.id} />
  ),
}));
vi.mock('@/components/pipelines/card/VisitsProposalsTab', () => ({ default: () => <div data-testid="aba-visitas" /> }));
vi.mock('@/components/pipelines/card/CardOriginTab', () => ({
  default: (p: { manualOrigin: string }) => <div data-testid="aba-origem">{p.manualOrigin}</div>,
}));

const etapas = [
  { id: 's1', name: 'Novo', color: '#3b82f6', position: 1 },
  { id: 's2', name: 'Agendou visita', color: '#22c55e', position: 2 },
] as never;

const deFormulario = {
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  item_id: 'c1',
  type: 'contact',
  is_lead: true,
  contact: {
    id: 'c1',
    name: 'Maria Souza',
    phone_number: '5511988887734',
    email: 'maria@exemplo.com',
    labels: [{ name: 'quente', color: '#ef4444' }],
  },
  assignee: { id: 'u1', name: 'Ana' },
  lead_origin: { source: 'manual', manual_origin: 'Indicação' },
  roleta: null,
} as never;

const deConversa = {
  id: 'i2',
  pipeline_id: 'p1',
  stage_id: 's1',
  item_id: '77',
  type: 'conversation',
  is_lead: false,
  conversation: {
    id: 77,
    contact: { id: 'c2', name: 'João Lima' },
    labels: [],
    additional_attributes: { utm_source: 'facebook' },
  },
  assignee: { id: 'u2', name: 'Bruno' },
  lead_origin: null,
  roleta: null,
} as never;

const semFunil = {
  id: '',
  item_id: 'c3',
  type: 'contact',
  pipeline_id: '',
  stage_id: '',
  is_lead: true,
  contact: { id: 'c3', name: 'Ana Prado' },
  roleta: null,
} as never;

function abrir(props: Partial<Parameters<typeof EditItemModal>[0]> = {}) {
  const onItemStageMoved = vi.fn();
  const onLabelsChanged = vi.fn();
  render(
    <MemoryRouter>
      <EditItemModal
        open
        onOpenChange={vi.fn()}
        item={deFormulario}
        stages={etapas}
        onItemStageMoved={onItemStageMoved}
        onLabelsChanged={onLabelsChanged}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onItemStageMoved, onLabelsChanged };
}

const campo = (rotulo: string) => within(screen.getByText(rotulo).parentElement as HTMLElement).getByRole('combobox');

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.getContactEvents.mockResolvedValue({
    data: [{ id: 'ev1', eventName: 'Entrou no funil', occurredAt: '2026-10-01T10:00:00Z', properties: {} }],
  });
  s.getLabels.mockResolvedValue({
    data: [
      { id: 'l1', title: 'quente', color: '#ef4444' },
      { id: 'l2', title: 'investidor', color: '#7c3aed' },
    ],
  });
  s.getAll.mockResolvedValue([]);
  s.listForLead.mockResolvedValue([]);
  s.moveItem.mockResolvedValue({});
  s.updateContact.mockResolvedValue({});
  s.assignConversation.mockResolvedValue({});
  s.addLabels.mockResolvedValue({});
});

describe('janela do card · caracterização (E4)', () => {
  it('mostra quem é: nome, telefone formatado, e-mail e a origem em selo', async () => {
    abrir();
    const janela = await screen.findByRole('dialog', { name: 'Maria Souza' });

    expect(within(janela).getByText('(11) 98888-7734')).toBeInTheDocument();
    expect(within(janela).getByText('maria@exemplo.com')).toBeInTheDocument();
    expect(within(janela).getByText(/Indicação/)).toBeInTheDocument();
    expect(within(janela).getByTestId('atalhos')).toHaveTextContent('Maria Souza');
    expect(within(janela).getByRole('button', { name: 'Mais ações do card' })).toBeInTheDocument();
  });

  it('etapa muda na hora, avisa o quadro e recarrega o histórico', async () => {
    const { onItemStageMoved } = abrir();
    await waitFor(() => expect(s.getContactEvents).toHaveBeenCalledTimes(1));

    await userEvent.click(campo('Etapa'));
    await userEvent.click(await screen.findByRole('option', { name: 'Agendou visita' }));

    await waitFor(() =>
      expect(s.moveItem).toHaveBeenCalledWith({ item_id: 'i1', pipeline_id: 'p1', from_stage_id: 's1', to_stage_id: 's2' }),
    );
    expect(onItemStageMoved).toHaveBeenCalledWith('i1', 's2');
    await waitFor(() => expect(s.getContactEvents).toHaveBeenCalledTimes(2));
  });

  it('etapa que falha volta para a anterior e avisa', async () => {
    s.moveItem.mockRejectedValue(new Error('fora'));
    abrir();

    await userEvent.click(campo('Etapa'));
    await userEvent.click(await screen.findByRole('option', { name: 'Agendou visita' }));

    await waitFor(() => expect(s.toastError).toHaveBeenCalledWith('Não consegui mudar a etapa'));
    expect(campo('Etapa')).toHaveTextContent('Novo');
  });

  it('responsável de lead de formulário grava no contato', async () => {
    abrir();
    await userEvent.click(campo('Responsável'));
    await userEvent.click(await screen.findByRole('option', { name: 'Bruno' }));

    await waitFor(() => expect(s.updateContact).toHaveBeenCalledWith('c1', { default_assignee_id: 'u2' }));
  });

  it('responsável de card de conversa atribui a conversa', async () => {
    abrir({ item: deConversa });
    await userEvent.click(campo('Responsável'));
    await userEvent.click(await screen.findByRole('option', { name: 'Ana' }));

    await waitFor(() => expect(s.assignConversation).toHaveBeenCalledWith(77, 'u1'));
  });

  it('lead de anúncio da Meta com conversa ganha a etiqueta "meta" sozinho', async () => {
    abrir({ item: deConversa });
    await waitFor(() => expect(s.addLabels).toHaveBeenCalledWith('77', ['meta']));
  });

  it('etiqueta: aplicar grava a lista inteira no contato e avisa o quadro', async () => {
    const { onLabelsChanged } = abrir();
    expect(await screen.findByText('quente')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar etiqueta' }));
    await userEvent.click(await screen.findByRole('option', { name: 'investidor' }));

    await waitFor(() => expect(s.updateContact).toHaveBeenCalledWith('c1', { labels: ['quente', 'investidor'] }));
    expect(onLabelsChanged).toHaveBeenCalled();
  });

  it('etiqueta: o x tira a etiqueta', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Remover etiqueta' }));

    await waitFor(() => expect(s.updateContact).toHaveBeenCalledWith('c1', { labels: [] }));
  });

  it('histórico: até 100 eventos do contato, em Detalhes', async () => {
    abrir();

    expect(await screen.findByText('Entrou no funil')).toBeInTheDocument();
    expect(s.getContactEvents).toHaveBeenCalledWith('c1', { limit: 100 });
    expect(screen.getByTestId('observacoes')).toBeInTheDocument();
    expect(screen.getByTestId('imoveis')).toBeInTheDocument();
  });

  it('abas: Detalhes, Conversa, Visitas e propostas, Origem (com a origem escrita à mão)', async () => {
    abrir();
    expect(screen.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Conversa' }));
    expect(await screen.findByTestId('aba-conversa')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Visitas e propostas' }));
    expect(await screen.findByTestId('aba-visitas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Origem' }));
    expect(await screen.findByTestId('aba-origem')).toHaveTextContent('Indicação');
  });

  it('aba Tarefas entre Conversa e Visitas: o bloco do card e o número na aba', async () => {
    abrir();
    expect(screen.getAllByRole('tab').map(t => t.textContent?.trim())).toEqual([
      'Detalhes',
      'Conversa',
      'Tarefas',
      'Visitas e propostas',
      'Origem',
    ]);

    await userEvent.click(screen.getByRole('tab', { name: 'Tarefas' }));
    const bloco = await screen.findByTestId('aba-tarefas');
    expect(bloco).toHaveAttribute('data-ids', 'i1');
    expect(bloco).toHaveAttribute('data-criar', 'i1');

    await userEvent.click(bloco);
    expect(await screen.findByRole('tab', { name: /^Tarefas \(2\)/ })).toBeInTheDocument();
  });

  it('card sem funil: Tarefas pede para colocar no funil, e o Colocar no funil vai pela conversa', async () => {
    abrir({
      item: { ...(semFunil as object), conversation: { id: 88 } } as never,
      stages: [] as never,
      onColocadoNoFunil: vi.fn(),
    });
    expect(screen.getByTestId('colocar-no-funil')).toHaveAttribute('data-conversa', '88');

    await userEvent.click(screen.getByRole('tab', { name: 'Tarefas' }));
    expect(await screen.findByText('Pra criar tarefa, coloque o lead no funil.')).toBeInTheDocument();
    expect(screen.queryByTestId('aba-tarefas')).toBeNull();
  });

  it('aba Conversa recebe o card, com a conversa dele', async () => {
    abrir({ item: deConversa });
    await userEvent.click(screen.getByRole('tab', { name: 'Conversa' }));

    const aba = await screen.findByTestId('aba-conversa');
    expect(aba).toHaveAttribute('data-item', 'i2');
    expect(aba).toHaveAttribute('data-conversa', '77');
  });

  describe('menu "Mais ações do card"', () => {
    const abrirMenu = async () => userEvent.click(screen.getByRole('button', { name: 'Mais ações do card' }));

    it('lista as ações de hoje: copiar link, mandar pra roleta, juntar e remover do funil', async () => {
      abrir();
      await abrirMenu();

      expect(await screen.findByRole('menuitem', { name: /Copiar link do card/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Mandar pra roleta/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Juntar com outro contato/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Remover do funil/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Tirar da roleta/ })).toBeNull();
    });

    it('Remover do funil confirma, chama o serviço com funil e card e fecha a janela', async () => {
      s.removeItem.mockResolvedValue(undefined);
      const onOpenChange = vi.fn();
      abrir({ onOpenChange });
      await abrirMenu();
      await userEvent.click(await screen.findByRole('menuitem', { name: /Remover do funil/ }));

      const confirmacao = await screen.findByRole('dialog', { name: 'Remover do funil?' });
      expect(s.removeItem).not.toHaveBeenCalled();
      await userEvent.click(within(confirmacao).getByRole('button', { name: 'Remover do funil' }));

      await waitFor(() => expect(s.removeItem).toHaveBeenCalledWith('p1', 'i1'));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('Mandar pra roleta escolhe a roleta ligada e manda o lead', async () => {
      s.getAll.mockResolvedValue([{ id: 'r1', name: 'Roleta Norte', is_active: true }]);
      s.assign.mockResolvedValue({ assigned_user: { name: 'Bruno' } });
      abrir();
      await waitFor(() => expect(s.getAll).toHaveBeenCalled());
      await abrirMenu();
      await userEvent.click(await screen.findByRole('menuitem', { name: /Mandar pra roleta/ }));

      const dialogo = await screen.findByRole('dialog', { name: 'Mandar pra roleta' });
      await userEvent.click(within(dialogo).getByRole('combobox', { name: 'Roleta' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Roleta Norte' }));
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Mandar pra roleta' }));

      await waitFor(() => expect(s.assign).toHaveBeenCalledTimes(1));
      expect(s.assign.mock.calls[0][0]).toBe('r1');
    });

    it('Juntar com outro contato abre a junção com o contato do card', async () => {
      abrir();
      await abrirMenu();
      await userEvent.click(await screen.findByRole('menuitem', { name: /Juntar com outro contato/ }));

      expect(await screen.findByTestId('juntar')).toHaveAttribute('data-contato', 'c1');
    });
  });

  describe('roleta no card', () => {
    const daRoleta = {
      ...(deFormulario as object),
      roleta: { id: 'r1', name: 'Roleta Norte' },
    } as never;
    const oferta = { id: 'o1', status: 'pending', corretor: 'Carlos', lead_name: 'Maria Souza' };

    it('lead que veio pela roleta mostra de qual roleta', async () => {
      abrir({ item: daRoleta });
      expect(await screen.findByText(/veio pela Roleta Norte/)).toBeInTheDocument();
    });

    it('oferta correndo: avisa quem decide e "Tirar da roleta" cancela a oferta (menu e bloco)', async () => {
      s.listForLead.mockResolvedValue([oferta]);
      s.cancelForLead.mockResolvedValue({ cancelled: 1, owner_id: null });
      abrir({ item: daRoleta });

      expect(await screen.findByText(/No sorteio agora, esperando o aceite de/)).toBeInTheDocument();
      expect(s.listForLead).toHaveBeenCalledWith('c1');
      expect(screen.getByText('Carlos')).toBeInTheDocument();

      // também aparece no menu "Mais ações"
      await userEvent.click(screen.getByRole('button', { name: 'Mais ações do card' }));
      expect(await screen.findByRole('menuitem', { name: /Tirar da roleta/ })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      await userEvent.click(screen.getByRole('button', { name: 'Tirar da roleta' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Tirar da roleta' });
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Tirar da roleta' }));

      await waitFor(() => expect(s.cancelForLead).toHaveBeenCalledWith('c1', null));
      await waitFor(() => expect(screen.queryByText(/No sorteio agora/)).toBeNull());
    });
  });

  it('card no funil: Meta compacta e Ganho | Perdido no rodapé', () => {
    abrir();
    expect(screen.getByTestId('meta')).toHaveAttribute('data-variante', 'compacto');
    expect(screen.getByTestId('ganho-perdido')).toBeInTheDocument();
    expect(screen.getByTestId('followup')).toBeInTheDocument();
  });

  it('card sem funil: "Colocar no funil" no lugar da etapa, sem Meta e sem Ganho | Perdido', () => {
    abrir({ item: semFunil, stages: [] as never, onColocadoNoFunil: vi.fn() });

    expect(screen.getByTestId('colocar-no-funil')).toBeInTheDocument();
    expect(screen.queryByText('Etapa')).toBeNull();
    expect(screen.queryByTestId('meta')).toBeNull();
    expect(screen.queryByTestId('ganho-perdido')).toBeNull();
  });

  it('fechada, a janela não busca nada', () => {
    render(
      <MemoryRouter>
        <EditItemModal open={false} onOpenChange={vi.fn()} item={deFormulario} stages={etapas} />
      </MemoryRouter>,
    );
    expect(s.getContactEvents).not.toHaveBeenCalled();
    expect(s.getAll).not.toHaveBeenCalled();
  });

  // O que a Parte 3 (P3-T5) ligou na janela: a situação do card.
  it('card ganho: selo ao lado do nome e a Etapa travada (reabrir antes)', () => {
    abrir({ item: { ...(deFormulario as object), status: 'won', won_at: '2026-10-06T15:00:00Z' } as never });

    expect(screen.getByText('Ganho')).toHaveAttribute('data-situacao', 'won');
    expect(campo('Etapa')).toBeDisabled();
    expect(screen.getByText('Lead fechado não muda de etapa. Reabra para mexer.')).toBeInTheDocument();
  });

  it('o rodapé gravou a situação: a janela mostra o selo, trava a Etapa e avisa o quadro', async () => {
    const onItemStatusChanged = vi.fn();
    abrir({ onItemStatusChanged });
    expect(screen.queryByText('Ganho')).toBeNull();

    await userEvent.click(screen.getByTestId('ganho-perdido'));

    expect(await screen.findByText('Ganho')).toHaveAttribute('data-situacao', 'won');
    expect(onItemStatusChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'won' }));
    expect(campo('Etapa')).toBeDisabled();
  });

  it('o rodapé gravou a situação: o Histórico recarrega', async () => {
    abrir();
    await waitFor(() => expect(s.getContactEvents).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByTestId('ganho-perdido'));

    await waitFor(() => expect(s.getContactEvents).toHaveBeenCalledTimes(2));
    expect(s.getContactEvents).toHaveBeenLastCalledWith('c1', { limit: 100 });
  });
});
