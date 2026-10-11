import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactsFiltros from './ContactsFiltros';
import { FILTROS_VAZIOS } from '@/features/contatos/filtros';

const getLabels = vi.hoisted(() => vi.fn());
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels } }));

const abrir = async () => {
  render(
    <ContactsFiltros pilula="todos" onPilula={() => {}} filtros={FILTROS_VAZIOS} onFiltros={() => {}} daEquipe={false} users={[]} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
};

beforeEach(() => getLabels.mockReset());

describe('ContactsFiltros · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não o vazio', async () => {
    getLabels.mockRejectedValueOnce(new Error('rede'));
    await abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/^Nenhuma etiqueta/)).toBeNull();
    getLabels.mockResolvedValueOnce({ data: [{ title: 'quente' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('quente', { selector: 'span' })).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a lista', async () => {
    getLabels.mockRejectedValueOnce(new Error('rede'));
    await abrir();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    getLabels.mockResolvedValue({ data: [{ title: 'quente' }] });
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText('quente', { selector: 'span' })).toHaveLength(1);
  });
});
