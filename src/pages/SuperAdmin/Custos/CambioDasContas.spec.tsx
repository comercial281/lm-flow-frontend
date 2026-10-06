import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CambioDasContas from './CambioDasContas';

const padrao = { data: { success: true, data: { value: 5.46, source: 'default', default_value: 5.46 } } };

describe('Câmbio das contas', () => {
  beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

  it('mostra o câmbio, muda e avisa a tela para recarregar', async () => {
    api.get.mockResolvedValue(padrao);
    api.put.mockResolvedValue({ data: { success: true, data: { value: 5.3, source: 'accounting', default_value: 5.46 } } });
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<CambioDasContas aoMudar={aoMudar} />);
    expect(await screen.findByText(/5,46/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mudar' }));
    const campo = screen.getByLabelText('Reais por dólar');
    await user.clear(campo);
    await user.type(campo, '5,30');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/super/costs/rate', { value: '5,30' }));
    expect(aoMudar).toHaveBeenCalled();
    expect(await screen.findByText(/5,30/)).toBeInTheDocument();
  });

  it('valor inválido trava o Salvar e diz o porquê', async () => {
    api.get.mockResolvedValue(padrao);
    const user = userEvent.setup();
    render(<CambioDasContas aoMudar={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Mudar' }));
    const campo = screen.getByLabelText('Reais por dólar');
    await user.clear(campo);
    await user.type(campo, 'abc');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(screen.getByText('Digite um valor maior que zero, como 5,46.')).toBeInTheDocument();
  });

  it('erro ao ler aparece como erro, com tentar de novo', async () => {
    api.get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(padrao);
    const user = userEvent.setup();
    render(<CambioDasContas aoMudar={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/5,46/)).toBeInTheDocument();
  });
});
