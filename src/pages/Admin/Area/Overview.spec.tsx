import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/services/core/api', () => ({
  default: { get: apiGet },
}));

import AdminOverview from './Overview';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminOverview />
    </MemoryRouter>,
  );
}

describe('AdminOverview', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('conta os tenants por status a partir do que a API devolve', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'Marcio', slug: 'marcio', status: 'active', members: 3 },
          { id: '2', name: 'Eduardo', slug: 'edu', status: 'active', members: 2 },
          { id: '3', name: 'Novo', slug: 'novo', status: 'trial', members: 1 },
          { id: '4', name: 'Parado', slug: 'parado', status: 'suspended', members: 1 },
          // arquivado não conta como ativo
          { id: '5', name: 'Velho', slug: 'velho', status: 'active', members: 0, archived: true },
        ],
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Ativos')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/super/pooled_tenants');

    // 2 ativos (o archived não entra), 1 provisionando, 1 congelado, 0 com erro
    const ativos = screen.getByText('Ativos').closest('div')?.parentElement;
    expect(ativos?.textContent).toContain('2');
  });

  it('destaca cliente com erro pelo nome', async () => {
    apiGet.mockResolvedValue({
      data: { data: [{ id: '9', name: 'Quebrado', slug: 'q', status: 'error', members: 1 }] },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('1 cliente está com erro')).toBeInTheDocument());
    expect(screen.getByText('Quebrado')).toBeInTheDocument();
  });

  // Regra desta tela: se a API cair, mostrar erro — nunca renderizar zero e
  // deixar o Giovani achar que ele tem zero cliente.
  it('mostra erro quando a API falha, em vez de zerar os números', async () => {
    apiGet.mockRejectedValue(new Error('boom'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Não consegui carregar os clientes.')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Ativos')).not.toBeInTheDocument();
  });
});
