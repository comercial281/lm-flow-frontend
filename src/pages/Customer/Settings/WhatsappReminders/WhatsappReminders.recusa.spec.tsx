import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ list: vi.fn(), toastError: vi.fn() }));

vi.mock('@/services/whatsappReminders', () => ({
  whatsappRemindersService: {
    list: (...a: unknown[]) => mocks.list(...a),
    listGroups: vi.fn().mockResolvedValue([]),
    execute: vi.fn(),
    remove: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => mocks.toastError(...a), success: vi.fn() } }));
// `loadInboxes` chama `api.get('/inboxes')` direto (não é o serviço desta tela);
// sem mock, cada teste imprime o erro de rede-de-verdade no stderr — ruído do
// ambiente, não do comportamento sob teste.
vi.mock('@/services/core/api', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('not mocked')) } }));

import WhatsappReminders from './WhatsappReminders';

describe('Lembretes WhatsApp: recusa explicada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 mostra o aviso do cargo, sem toast', async () => {
    mocks.list.mockRejectedValue({ response: { status: 403 } });
    render(<WhatsappReminders />);
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('queda de rede mostra "Não deu pra carregar" e NÃO culpa o cargo', async () => {
    // Fase 3: erro é estado da tela (com "Tentar de novo"), não toast em cima
    // de uma lista vazia que manda criar o que já existe.
    mocks.list.mockRejectedValue(new Error('Network Error'));
    render(<WhatsappReminders />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
