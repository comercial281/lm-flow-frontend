// src/features/cardDoLead/useCardDoLead.spec.ts
// O estado do card do lead sem a moldura (E4): o mesmo comportamento da janela,
// agora num hook que a janela e a página usam.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCardDoLead } from './useCardDoLead';

const s = vi.hoisted(() => ({
  moveItem: vi.fn(),
  setItemStatus: vi.fn(),
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
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: s.toastSuccess, error: s.toastError } }));
vi.mock('@/hooks/useAccountUsers', () => ({ useAccountUsers: () => ({ users: [{ id: 'u1', name: 'Ana' }] }) }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/hooks/useOpenLeadConversation', () => ({
  useOpenLeadConversation: () => ({ openLeadConversation: vi.fn(), startConversationModal: null, opening: false }),
}));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => null }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true, isReady: true }) }));
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
  pipelinesService: { moveItem: s.moveItem, setItemStatus: s.setItemStatus },
}));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: s.getAll, assign: s.assign },
  roletaLabel: (r?: { display_name?: string | null; name?: string | null } | null) => r?.display_name || r?.name || 'Roleta',
}));
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({
  brokerAssignmentsService: { listForLead: s.listForLead },
}));

const etapas = [
  { id: 's1', name: 'Novo', color: '#3b82f6', position: 1 },
  { id: 's2', name: 'Agendou visita', color: '#22c55e', position: 2 },
  // A coluna do Ganho (ajuste de 08/10): tipo Concluída.
  { id: 's9', name: 'Concluído', color: '#10b981', position: 9, stage_type: 'completed' },
] as never;

const completo = {
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: {
    id: 'c1',
    name: 'Maria Souza',
    phone_number: '5511988887734',
    email: 'maria@exemplo.com',
    labels: [{ name: 'quente' }],
  },
  conversation: { id: 77, labels: [{ title: 'meta' }], additional_attributes: {} },
  assignee: { id: 'u1', name: 'Ana' },
  lead_origin: { source: 'manual', manual_origin: 'Indicação' },
  roleta: null,
} as never;

const soContato = {
  id: 'i3',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: { id: 'c9', name: '5511977776655', phone_number: '5511977776655' },
  roleta: null,
} as never;

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.getContactEvents.mockResolvedValue({ data: [] });
  s.getLabels.mockResolvedValue({ data: [] });
  s.getAll.mockResolvedValue([]);
  s.listForLead.mockResolvedValue([]);
  s.moveItem.mockResolvedValue({});
  s.updateContact.mockResolvedValue({});
});

describe('useCardDoLead', () => {
  it('inicializa do card: etapa, telefone, e-mail, responsável, etiquetas do contato e da conversa, origem escrita', async () => {
    const { result } = renderHook(() => useCardDoLead(completo, { aberto: true, stages: etapas }));

    await waitFor(() => expect(s.getContactEvents).toHaveBeenCalledWith('c1', { limit: 100 }));
    expect(result.current.etapa.id).toBe('s1');
    expect(result.current.etapa.atual?.name).toBe('Novo');
    expect(result.current.identidade.telefone).toBe('5511988887734');
    expect(result.current.identidade.email).toBe('maria@exemplo.com');
    expect(result.current.responsavel.id).toBe('u1');
    expect(result.current.etiquetas.ativas).toEqual(['quente', 'meta']);
    expect(result.current.origemManual.texto).toBe('Indicação');
    expect(result.current.nomeExibido).toBe('Maria Souza');
    expect(result.current.foraDoFunil).toBe(false);
  });

  it('nome que é telefone vira o telefone formatado', () => {
    const { result } = renderHook(() => useCardDoLead(soContato, { aberto: true, stages: etapas }));
    expect(result.current.nomeExibido).toBe('(11) 97777-6655');
  });

  it('fechado (aberto=false) não busca nada', () => {
    renderHook(() => useCardDoLead(completo, { aberto: false, stages: etapas }));
    expect(s.getContactEvents).not.toHaveBeenCalled();
    expect(s.getAll).not.toHaveBeenCalled();
    expect(s.getLabels).not.toHaveBeenCalled();
  });

  it('sem card: valores vazios, nada buscado', () => {
    const { result } = renderHook(() => useCardDoLead(null, { aberto: true, stages: etapas }));
    expect(result.current.contato).toBeNull();
    expect(result.current.nomeExibido).toBe('Lead sem nome');
    expect(s.getContactEvents).not.toHaveBeenCalled();
  });

  it('mover etapa: otimista, grava e avisa quem abriu', async () => {
    const onItemStageMoved = vi.fn();
    const { result } = renderHook(() => useCardDoLead(completo, { aberto: true, stages: etapas, onItemStageMoved }));

    await act(async () => {
      await result.current.etapa.mover('s2');
    });

    expect(s.moveItem).toHaveBeenCalledWith({ item_id: 'i1', pipeline_id: 'p1', from_stage_id: 's1', to_stage_id: 's2' });
    expect(onItemStageMoved).toHaveBeenCalledWith('i1', 's2');
    expect(result.current.etapa.id).toBe('s2');
  });

  it('mover etapa que falha volta e avisa', async () => {
    s.moveItem.mockRejectedValue(new Error('fora'));
    const { result } = renderHook(() => useCardDoLead(completo, { aberto: true, stages: etapas }));

    await act(async () => {
      await result.current.etapa.mover('s2');
    });

    expect(result.current.etapa.id).toBe('s1');
    expect(s.toastError).toHaveBeenCalledWith('Não consegui mudar a etapa');
  });

  it('responsável sem conversa grava no contato', async () => {
    const { result } = renderHook(() => useCardDoLead(soContato, { aberto: true, stages: etapas }));

    await act(async () => {
      await result.current.responsavel.trocar('u1');
    });

    expect(s.updateContact).toHaveBeenCalledWith('c9', { default_assignee_id: 'u1' });
    expect(result.current.responsavel.id).toBe('u1');
  });

  it('card sem funil (id vazio) é foraDoFunil', () => {
    const { result } = renderHook(() =>
      useCardDoLead({ id: '', contact: { id: 'c3', name: 'Ana' }, roleta: null } as never, { aberto: true, stages: [] }),
    );
    expect(result.current.foraDoFunil).toBe(true);
  });

  // Situação (Parte 3): card fechado não muda de etapa — reabrir antes.
  it('card perdido: situacao.fechado e mover etapa não grava nada', async () => {
    const perdido = { ...(completo as object), status: 'lost' } as never;
    const { result } = renderHook(() => useCardDoLead(perdido, { aberto: true, stages: etapas }));

    expect(result.current.situacao.fechado).toBe(true);
    await act(async () => {
      await result.current.etapa.mover('s2');
    });
    expect(s.moveItem).not.toHaveBeenCalled();
    expect(result.current.etapa.id).toBe('s1');
  });

  it('o rodapé gravou (situacao.aoMudar): o card da situação muda e a etapa trava', () => {
    const { result } = renderHook(() => useCardDoLead(completo, { aberto: true, stages: etapas }));
    expect(result.current.situacao.fechado).toBe(false);

    act(() => result.current.situacao.aoMudar({ ...(completo as object), status: 'won' } as never));

    expect(result.current.situacao.item?.status).toBe('won');
    expect(result.current.situacao.fechado).toBe(true);
  });

  // Ajuste de 08/10: Concluído na Etapa é Ganho (a mesma rota do botão).
  it('mover para Concluído marca Ganho pela rota da situação e avisa quem abriu', async () => {
    s.setItemStatus.mockResolvedValue({ id: 'i1', status: 'won', stage_id: 's9' });
    const onItemStageMoved = vi.fn();
    const onItemStatusChanged = vi.fn();
    const { result } = renderHook(() =>
      useCardDoLead(completo, { aberto: true, stages: etapas, onItemStageMoved, onItemStatusChanged }),
    );

    await act(async () => {
      await result.current.etapa.mover('s9');
    });

    expect(s.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'won' });
    expect(s.moveItem).not.toHaveBeenCalled();
    expect(onItemStageMoved).not.toHaveBeenCalled();
    expect(onItemStatusChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'won', stage_id: 's9' }));
    expect(result.current.situacao.fechado).toBe(true);
    expect(result.current.etapa.id).toBe('s9');
    expect(s.toastSuccess).toHaveBeenCalledWith('Lead marcado como ganho.');
  });

  it('o rodapé reabriu um Ganho: a Etapa vai para a coluna que o servidor devolveu', () => {
    const ganho = { ...(completo as object), status: 'won', stage_id: 's9' } as never;
    const { result } = renderHook(() => useCardDoLead(ganho, { aberto: true, stages: etapas }));

    act(() => result.current.situacao.aoMudar({ ...(ganho as object), status: 'open', stage_id: 's2' } as never));

    expect(result.current.etapa.id).toBe('s2');
    expect(result.current.situacao.fechado).toBe(false);
  });

  // Produção (P3): o rodapé gravando Ganho/Perdido/Reabrir trava a Etapa (e vice-versa).
  it('rodapé gravando (situacao.setRodapeSalvando): mover etapa espera', async () => {
    const { result } = renderHook(() => useCardDoLead(completo, { aberto: true, stages: etapas }));

    act(() => result.current.situacao.setRodapeSalvando(true));
    expect(result.current.situacao.rodapeSalvando).toBe(true);
    await act(async () => {
      await result.current.etapa.mover('s2');
    });
    expect(s.moveItem).not.toHaveBeenCalled();
    expect(result.current.etapa.id).toBe('s1');
  });
});
