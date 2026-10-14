import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StartConversationModal from './StartConversationModal';
import type { Contact } from '@/types/contacts';

const inboxes = vi.hoisted(() => vi.fn());
const modelos = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (k: string) => k.split('.').pop() ?? k }),
}));
vi.mock('@/services/contacts', () => ({ contactsService: { getContactableInboxes: inboxes } }));
vi.mock('@/services/conversations', () => ({ conversationAPI: {} }));
vi.mock('@/services/channels/messageTemplatesService', () => ({ default: { getTemplates: modelos } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const contato = { id: 'k1', name: 'Maria' } as unknown as Contact;
const evolution = {
  id: 1, name: 'Numero 1', channel_type: 'Channel::Whatsapp', available: true,
  can_create_conversation: true, recommended: true, channel: { provider: 'evolution' },
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  inboxes.mockReset().mockResolvedValue([evolution]);
  modelos.mockReset().mockResolvedValue({ data: [{ id: 't1', name: 'Boas vindas', settings: { status: 'APPROVED' }, components: [] }] });
});

describe('StartConversationModal · modelo de mensagem', () => {
  it('"Usar modelo de mensagem" é uma caixinha, sem a palavra Template na tela', async () => {
    render(<StartConversationModal open onOpenChange={() => {}} contact={contato} />);
    const caixa = await screen.findByRole('checkbox', { name: 'Usar modelo de mensagem' });
    expect(caixa).not.toBeChecked();
    expect(document.body.textContent).not.toMatch(/Template/);
  });

  it('canal por API não leva selo "API"', async () => {
    inboxes.mockResolvedValue([{ ...evolution, id: 2, name: 'Canal X', channel_type: 'Channel::Api' }]);
    render(<StartConversationModal open onOpenChange={() => {}} contact={contato} />);
    await screen.findByText('Canal X');
    expect(screen.queryByText('API')).toBeNull();
    expect(screen.queryByText('api')).toBeNull();
  });
});
