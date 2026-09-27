import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ listarFunis: vi.fn(), listarPastas: vi.fn(), toastError: vi.fn() }));

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  messageFunnelsService: { list: (...a: unknown[]) => mocks.listarFunis(...a), destroy: vi.fn(), update: vi.fn() },
  messageFunnelFoldersService: { list: (...a: unknown[]) => mocks.listarPastas(...a), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  messageFunnelTagsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/components/messageFunnels/MessageFunnelEditor', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => mocks.toastError(...a), success: vi.fn() } }));

import MessageFunnels from './MessageFunnels';

describe('Funis de mensagem: recusa explicada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarPastas.mockResolvedValue([]);
  });

  it('403 mostra o aviso do cargo, e não "Nenhum funil de mensagem"', async () => {
    mocks.listarFunis.mockRejectedValue({ response: { status: 403 } });
    render(<MessageFunnels />, { wrapper: MemoryRouter });
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('Nenhum funil de mensagem')).not.toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('queda de rede avisa o erro e NÃO culpa o cargo', async () => {
    mocks.listarFunis.mockRejectedValue(new Error('Network Error'));
    render(<MessageFunnels />, { wrapper: MemoryRouter });
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Erro ao carregar funis'));
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
