import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/condominiums/condominiumsService', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/condominiums/condominiumsService')>();
  return { ...real, condominiumsService: { ...real.condominiumsService, ...svc } };
});

import ListaDeCondominios from './ListaDeCondominios';

const linha = (id: string, name: string, over = {}) => ({
  id, name, kind: 'vertical', address_street: 'Rua das Flores', address_number: '120', address_neighborhood: 'Cambuí',
  address_city: 'Campinas', address_state: 'SP', units_count: 10, for_sale_count: 4, sold_count: 2,
  updated_at: new Date().toISOString(), cover_photo_url: null, ...over,
});
const resp = (data: unknown[], cities = ['Campinas', 'Valinhos']) => ({ data, meta: { total: data.length, page: 1, per_page: 50, cities } });

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; }
const abrir = (podeEditar = true) => render(
  <MemoryRouter><ListaDeCondominios podeEditar={podeEditar} /><Onde /></MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  svc.list.mockResolvedValue(resp([linha('c1', 'Edifício Aurora'), linha('c2', 'Residencial Bosque'), linha('c3', 'Torre Azul')]));
});

describe('Lista de condomínios', () => {
  it('mostra as 3 linhas com endereço e contagens', async () => {
    abrir();
    expect(await screen.findByText('Edifício Aurora')).toBeInTheDocument();
    expect(screen.getAllByTestId('linha-do-condominio')).toHaveLength(3);
    expect(screen.getAllByText('Rua das Flores, 120')).toHaveLength(3);
    expect(screen.getAllByText('Cambuí').length).toBeGreaterThan(0);
  });

  it('a busca chama a lista com q', async () => {
    abrir();
    await screen.findByText('Edifício Aurora');
    await userEvent.type(screen.getByLabelText('Buscar'), 'aurora');
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'aurora' })));
  });

  it('trocar a cidade chama a lista com city', async () => {
    abrir();
    await screen.findByText('Edifício Aurora');
    await userEvent.selectOptions(screen.getByLabelText('Cidade'), 'Valinhos');
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ city: 'Valinhos' })));
  });

  it('vazio mostra o texto e o botão só com permissão', async () => {
    svc.list.mockResolvedValue(resp([], []));
    const { unmount } = abrir(true);
    expect(await screen.findByText('Nenhum condomínio ainda')).toBeInTheDocument();
    expect(screen.getByText(/Cadastre o prédio uma vez e plugue os apartamentos nele/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Novo condomínio' }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties/condominios/novo');
    unmount();
    abrir(false);
    await screen.findByText('Nenhum condomínio ainda');
    expect(screen.queryByRole('button', { name: '+ Novo condomínio' })).not.toBeInTheDocument();
  });

  it('clicar na linha abre o condomínio', async () => {
    abrir();
    await userEvent.click(await screen.findByText('Residencial Bosque'));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties/condominios/c2');
  });

  it('erro mostra o estado de erro, não lista vazia', async () => {
    svc.list.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum condomínio ainda')).not.toBeInTheDocument();
  });
});
