// src/features/cardDoLead/useCardDoLead.responsavel.spec.ts
// Raio-X de 10/10/2026: o Responsável do card vinha EM BRANCO pro corretor (o
// nome saía de GET /users, que o cargo dele não lê). Só o gestor troca e só ele
// busca a lista; o nome vem do card e a própria pessoa é "Você".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCardDoLead } from './useCardDoLead';

const s = vi.hoisted(() => ({
  moveItem: vi.fn(),
  setItemStatus: vi.fn(),
  assignConversation: vi.fn(),
  addLabels: vi.fn(),
  removeLabels: vi.fn(),
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
const contas = vi.hoisted(() => ({ useAccountUsers: vi.fn(), gestor: false }));
vi.mock('@/hooks/useAccountUsers', () => ({ useAccountUsers: contas.useAccountUsers }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/hooks/useOpenLeadConversation', () => ({
  useOpenLeadConversation: () => ({ openLeadConversation: vi.fn(), startConversationModal: null, opening: false }),
}));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => null }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ can: (r: string, a: string) => (r === 'conversations' && a === 'read_all' ? contas.gestor : true), isReady: true }),
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (st: unknown) => unknown) => sel({ currentUser: { id: 'eu' } }) }));
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { assignConversation: s.assignConversation, addLabels: s.addLabels, removeLabels: s.removeLabels },
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


const card = (assignee: { id: string; name: string } | null) => ({
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: { id: 'c1', name: 'Maria', phone_number: '5511988887734', labels: [] },
  conversation: null,
  assignee,
  roleta: null,
}) as never;

const abrir = (item: unknown) =>
  renderHook(() => useCardDoLead(item as never, { aberto: true, stages: [] as never }));

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.getAll.mockResolvedValue([]);
  s.listForLead.mockResolvedValue([]);
  s.getLabels.mockResolvedValue({ data: [] });
  contas.useAccountUsers.mockReset();
  contas.useAccountUsers.mockReturnValue({ users: [] });
});

describe('useCardDoLead — responsável pro corretor', () => {
  it('não é gestor: não troca e nem busca a lista de pessoas', () => {
    contas.gestor = false;
    const { result } = abrir(card({ id: 'u9', name: 'Bruno Silva' }));

    expect(result.current.responsavel.podeTrocar).toBe(false);
    expect(contas.useAccountUsers).toHaveBeenCalledWith({ enabled: false });
  });

  it('o nome do responsável vem do card', () => {
    contas.gestor = false;
    const { result } = abrir(card({ id: 'u9', name: 'Bruno Silva' }));

    expect(result.current.responsavel.id).toBe('u9');
    expect(result.current.responsavel.nomeDoCard).toBe('Bruno Silva');
    expect(result.current.responsavel.meuId).toBe('eu');
  });

  it('gestor troca e busca a lista', () => {
    contas.gestor = true;
    const { result } = abrir(card(null));

    expect(result.current.responsavel.podeTrocar).toBe(true);
    expect(contas.useAccountUsers).toHaveBeenCalledWith({ enabled: true });
  });
});
