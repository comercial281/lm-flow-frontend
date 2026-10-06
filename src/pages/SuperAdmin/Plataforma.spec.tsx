import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const banks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock('@/services/superAdmin/platformBanksService', () => ({ platformBanksService: banks }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: { uploadAsset: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import Plataforma from './Plataforma';

// A cor da marca do banco é dado, e é a única cor fixa permitida na tela.
const ITAU = { key: 'itau', name: 'Itaú', color: '#EC7000', ink: null, logo_url: 'https://cdn.test/itau.png', default_url: null };

describe('Plataforma → Site (logos dos bancos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    banks.list.mockResolvedValue([ITAU]);
    banks.save.mockResolvedValue([{ ...ITAU, logo_url: '' }]);
  });

  it('erro ao carregar mostra o motivo e tenta de novo', async () => {
    banks.list.mockRejectedValueOnce({ response: { data: { error: 'servidor fora' } } });
    const user = userEvent.setup();
    render(<Plataforma />);
    expect(await screen.findByRole('alert')).toHaveTextContent('servidor fora');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Itaú')).toBeInTheDocument();
  });

  it('Tirar confirma dizendo que sai do site de todas as imobiliárias, e só então grava', async () => {
    const user = userEvent.setup();
    render(<Plataforma />);
    await user.click(await screen.findByRole('button', { name: 'Tirar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Tirar o logo do Itaú dos sites de todas as imobiliárias?');
    expect(banks.save).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Tirar' }));
    await waitFor(() => expect(banks.save).toHaveBeenCalledWith({ itau: '' }));
  });

  it('cancelar não tira', async () => {
    const user = userEvent.setup();
    render(<Plataforma />);
    await user.click(await screen.findByRole('button', { name: 'Tirar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(banks.save).not.toHaveBeenCalled();
  });
});
