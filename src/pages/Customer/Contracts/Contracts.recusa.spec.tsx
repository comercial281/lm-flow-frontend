import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@/services/contracts/contractsService', () => ({
  contractsService: { list: (...a: unknown[]) => mocks.list(...a), generate: vi.fn() },
  CONTRACT_STATUS_LABELS: {},
  CONTRACT_STATUS_COLORS: {},
}));

import Contracts from './Contracts';

describe('Contratos: recusa explicada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 mostra o aviso do cargo, e não "Nenhum contrato encontrado"', async () => {
    mocks.list.mockRejectedValue({ response: { status: 403 } });
    render(<Contracts />);
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('Nenhum contrato encontrado')).not.toBeInTheDocument();
  });

  it('queda de rede NÃO culpa o cargo — mostra a lista vazia de sempre', async () => {
    mocks.list.mockRejectedValue(new Error('Network Error'));
    render(<Contracts />);
    await waitFor(() => expect(screen.getByText('Nenhum contrato encontrado')).toBeInTheDocument());
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
