import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const svc = vi.hoisted(() => ({ minhasFichas: vi.fn(), gravarMinhaFicha: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: svc }));

import MinhaFicha from './MinhaFicha';

const ficha = (id: string, extra: Record<string, unknown> = {}) => ({
  id, inbox_id: `i-${id}`, phone: null, inbox_name: id === 'n1' ? 'Ana' : 'Bia', agent_id: 'a1', agent_name: 'Agente A',
  voice: { kind: 'corretor', name: 'Caio' }, house_voice: { kind: 'consultora', gender: 'ela' },
  ...extra,
});

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/ia-vendedora/minha-ficha']}>
      <Routes>
        <Route path="/ia-vendedora/minha-ficha" element={<MinhaFicha />} />
        <Route path="/dashboard" element={<p>Painel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MinhaFicha', () => {
  it('um cartão por número, com a voz só de leitura e a prévia', async () => {
    svc.minhasFichas.mockResolvedValue([ficha('n1'), ficha('n2')]);
    abrir();
    const cartoes = await screen.findAllByRole('group', { name: /Número/ });
    expect(cartoes).toHaveLength(2);
    const c = within(cartoes[0]);
    expect(c.getByText('Corretor')).toBeInTheDocument();
    expect(c.getByText('A voz quem escolhe é o gestor.')).toBeInTheDocument();
    expect(c.getByLabelText('Nome')).toHaveValue('Caio');
    expect(c.getByLabelText('Como se apresenta')).toBeInTheDocument();
    expect(c.getByRole('radiogroup', { name: 'Ele ou ela' })).toBeInTheDocument();
    expect(c.getByText(/Oi, Maria!/)).toHaveTextContent('Caio');
    // a voz não é editável
    expect(c.queryByRole('radio', { name: 'Consultora' })).toBeNull();
  });

  it('mudar o nome grava só {name}', async () => {
    svc.minhasFichas.mockResolvedValue([ficha('n1')]);
    svc.gravarMinhaFicha.mockResolvedValue(ficha('n1', { voice: { kind: 'corretor', name: 'Bia' } }));
    abrir();
    const campo = await screen.findByLabelText('Nome');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Bia');
    await userEvent.tab();
    await waitFor(() => expect(svc.gravarMinhaFicha).toHaveBeenCalledTimes(1));
    expect(svc.gravarMinhaFicha).toHaveBeenCalledWith('n1', { name: 'Bia' });
    expect(screen.getByLabelText('Nome')).toHaveValue('Bia');
  });

  it('escolher ele ou ela grava só {gender}', async () => {
    svc.minhasFichas.mockResolvedValue([ficha('n1')]);
    svc.gravarMinhaFicha.mockResolvedValue(ficha('n1', { voice: { kind: 'corretor', name: 'Caio', gender: 'ele' } }));
    abrir();
    await userEvent.click(await screen.findByRole('radio', { name: 'Ele' }));
    await waitFor(() => expect(svc.gravarMinhaFicha).toHaveBeenCalledWith('n1', { gender: 'ele' }));
  });

  it('sem mudar nada, não grava', async () => {
    svc.minhasFichas.mockResolvedValue([ficha('n1')]);
    abrir();
    await userEvent.click(await screen.findByLabelText('Nome'));
    await userEvent.tab();
    expect(svc.gravarMinhaFicha).not.toHaveBeenCalled();
  });

  it('403: o campo volta ao valor anterior e a frase do servidor aparece', async () => {
    svc.minhasFichas.mockResolvedValue([ficha('n1')]);
    svc.gravarMinhaFicha.mockRejectedValue({
      response: { status: 403, data: { error: { code: 'OWN_FICHA_NOT_OWNER', message: 'Este número não é seu.' } } },
    });
    abrir();
    const campo = await screen.findByLabelText('Nome');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Bia');
    await userEvent.tab();
    expect(await screen.findByText('Este número não é seu.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Caio');
  });

  it('sem número a tela cai na Dashboard', async () => {
    svc.minhasFichas.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText('Painel')).toBeInTheDocument();
  });
});
