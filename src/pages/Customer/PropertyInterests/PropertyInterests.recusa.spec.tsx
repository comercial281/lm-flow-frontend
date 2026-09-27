import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ list: vi.fn(), toastError: vi.fn() }));

vi.mock('@/services/propertyInterests/propertyInterestsService', () => ({
  propertyInterestsService: {
    list: (...a: unknown[]) => mocks.list(...a),
    advance: vi.fn(),
    closeWon: vi.fn(),
    closeLost: vi.fn(),
    create: vi.fn(),
  },
  INTEREST_STAGE_LABELS: {},
  INTEREST_STAGE_COLORS: {},
}));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => mocks.toastError(...a), success: vi.fn(), info: vi.fn() } }));

import PropertyInterests from './PropertyInterests';

const montar = () => render(<MemoryRouter><PropertyInterests /></MemoryRouter>);

describe('Interesses: recusa explicada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 mostra o aviso do cargo, sem toast', async () => {
    mocks.list.mockRejectedValue({ response: { status: 403 } });
    montar();
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('queda de rede avisa o erro e NÃO culpa o cargo', async () => {
    mocks.list.mockRejectedValue(new Error('Network Error'));
    montar();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Erro ao carregar interesses'));
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
