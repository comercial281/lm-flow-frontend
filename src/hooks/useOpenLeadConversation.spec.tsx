import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const navigate = vi.fn();
const getContactConversations = vi.fn();
const getContact = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: {
    getContactConversations: (...args: unknown[]) => getContactConversations(...args),
    getContact: (...args: unknown[]) => getContact(...args),
  },
}));

vi.mock('@/components/contacts/StartConversationModal', () => ({
  default: () => <div data-testid="start-conversation-modal" />,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useOpenLeadConversation } from './useOpenLeadConversation';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

type TestItem = Parameters<ReturnType<typeof useOpenLeadConversation>['openLeadConversation']>[0];

const item = (extra: Record<string, unknown>) =>
  ({ id: 'card-1', contact: { id: 'contact-1', name: 'Lead' }, ...extra }) as unknown as TestItem;

describe('useOpenLeadConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContactConversations.mockResolvedValue({ data: [] });
    getContact.mockResolvedValue({ id: 'contact-1', name: 'Lead' });
  });

  it('navigates straight to the conversation already on the card', async () => {
    const { result } = renderHook(() => useOpenLeadConversation());

    await act(async () => {
      await result.current.openLeadConversation(item({ conversation: { id: UUID_A } }));
    });

    expect(navigate).toHaveBeenCalledWith(`/conversations/${UUID_A}`);
    expect(getContactConversations).not.toHaveBeenCalled();
  });

  // Lead de formulário/anúncio: o serializer manda a conversa de WhatsApp mais
  // recente do contato num campo à parte, porque o card não tem conversation.
  it('falls back to whatsapp_conversation_id for a form lead', async () => {
    const { result } = renderHook(() => useOpenLeadConversation());

    await act(async () => {
      await result.current.openLeadConversation(item({ whatsapp_conversation_id: UUID_B }));
    });

    expect(navigate).toHaveBeenCalledWith(`/conversations/${UUID_B}`);
  });

  // A rota devolve para a lista, em silêncio, qualquer id que não seja uuid.
  // Mandar um display_id para lá seria "cliquei e não aconteceu nada".
  it('ignores a non-uuid id and looks the conversation up on the contact', async () => {
    getContactConversations.mockResolvedValue({ data: [{ id: UUID_A }] });
    const { result } = renderHook(() => useOpenLeadConversation());

    await act(async () => {
      await result.current.openLeadConversation(item({ conversation: { id: '4607' } }));
    });

    expect(getContactConversations).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`/conversations/${UUID_A}`);
  });

  it('opens the start-conversation modal when the lead has no conversation at all', async () => {
    const { result } = renderHook(() => useOpenLeadConversation());

    expect(result.current.startConversationModal).toBeNull();

    await act(async () => {
      await result.current.openLeadConversation(item({}));
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(getContact).toHaveBeenCalledWith('contact-1');
    await waitFor(() => expect(result.current.startConversationModal).not.toBeNull());
  });
});
