import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MessageFunnels from './MessageFunnels';

const listarFunis = vi.fn().mockResolvedValue([]);
const criarPasta = vi.fn().mockResolvedValue({});
const renomearPasta = vi.fn().mockResolvedValue({});
const excluirPasta = vi.fn().mockResolvedValue(undefined);
const listarPastas = vi.fn();

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  messageFunnelsService: {
    list: (...a: unknown[]) => listarFunis(...a),
    destroy: vi.fn(),
    update: vi.fn(),
  },
  messageFunnelFoldersService: {
    list: (...a: unknown[]) => listarPastas(...a),
    create: (...a: unknown[]) => criarPasta(...a),
    update: (...a: unknown[]) => renomearPasta(...a),
    destroy: (...a: unknown[]) => excluirPasta(...a),
  },
}));

vi.mock('@/components/messageFunnels/MessageFunnelEditor', () => ({ default: () => null }));

const PASTA = { id: 'p1', name: 'Prospecção', color: '#888', position: 0, funnels_count: 7, enabled_count: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  listarFunis.mockResolvedValue([]);
  listarPastas.mockResolvedValue([PASTA]);
});

const montar = async () => {
  render(<MessageFunnels />, { wrapper: MemoryRouter });
  await screen.findByText('Prospecção');
};

describe('Pastas de funil, sem caixinha do navegador', () => {
  it('criar pasta passa pelo diálogo do sistema, não pelo window.prompt', async () => {
    const usuario = userEvent.setup();
    await montar();

    await usuario.click(screen.getByRole('button', { name: /Nova pasta/i }));
    // Se ainda fosse window.prompt, não existiria diálogo nenhum pra achar.
    expect(await screen.findByText('Nova pasta', { selector: 'h2, h3, [role="heading"]' })).toBeInTheDocument();

    await usuario.type(screen.getByPlaceholderText('Nome da pasta'), 'Retomada');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(criarPasta).toHaveBeenCalledWith({ name: 'Retomada' }));
  });

  it('não deixa salvar pasta com nome vazio', async () => {
    const usuario = userEvent.setup();
    await montar();

    await usuario.click(screen.getByRole('button', { name: /Nova pasta/i }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(criarPasta).not.toHaveBeenCalled();
  });

  it('excluir pasta diz quantos funis voltam pra "Sem pasta"', async () => {
    const usuario = userEvent.setup();
    await montar();

    await usuario.click(screen.getByTitle('Excluir pasta'));
    // O window.confirm não sabia esse número; o diálogo sabe, e é o que evita
    // a pessoa achar que vai apagar os funis junto.
    expect(await screen.findByText(/7 funis de dentro voltam/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluirPasta).toHaveBeenCalledWith('p1'));
  });
});
