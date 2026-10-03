import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const own = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), mudarStatus: vi.fn(), salvarObservacoes: vi.fn(), remove: vi.fn() }));
const pode = vi.hoisted(() => ({ gerir: true }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: own }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => (r === 'properties' && (a === 'update' || a === 'create') ? pode.gerir : true) }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: () => Promise.resolve({ data: [{ id: 'u1', name: 'Ivan' }, { id: 'u2', name: 'Bia' }] }) } }));
const imoveis = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...imoveis } };
});
import FichaDoProprietario from './FichaDoProprietario';

const ficha = { id: 'o1', name: 'Maria Souza', phone: '(11) 99999-8888', phone_secondary: null, email: 'm@x.com', document: '123',
  status: 'available', source: 'manual', notes: '', captor: { id: 'u1', name: 'Ivan' }, authorized_users: [],
  status_changed_at: null, status_changed_by: null, created_at: '2026-09-01', updated_at: '',
  properties: [{ id: 'p1', code: 'AP0461', title: 'Apê', listing_kind: 'resale', status: 'active', display_price: 'R$ 500.000', cover_photo_url: null }],
  history: [{ from: 'available', to: 'no_response', user: { id: 'u1', name: 'Ivan' }, at: '2026-10-02T10:00:00Z' }] };

beforeEach(() => { vi.clearAllMocks(); pode.gerir = true; own.get.mockResolvedValue(ficha); });

const abrir = () => render(<MemoryRouter initialEntries={['/property-owners/o1']}><Routes>
  <Route path="/property-owners/:id" element={<FichaDoProprietario />} /></Routes></MemoryRouter>);

describe('FichaDoProprietario', () => {
  it('mostra WhatsApp com 55, imóveis, histórico e cadastrar imóvel', async () => {
    abrir();
    expect(await screen.findByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/5511999998888');
    expect(screen.getByText('AP0461')).toBeInTheDocument();
    expect(screen.getByText(/Disponível → Sem resposta/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar imóvel deste proprietário' }))
      .toHaveAttribute('href', '/properties/new?tipo=revenda&proprietario=o1');
  });

  it('gestor escolhe corretores autorizados; captador vem travado', async () => {
    own.update.mockResolvedValue({ ...ficha, authorized_users: [{ id: 'u2', name: 'Bia' }] });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Escolher corretores' }));
    expect(await screen.findByRole('checkbox', { name: /Ivan/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(own.update).toHaveBeenCalledWith('o1', { authorized_user_ids: ['u2'] }));
  });

  it('corretor não vê Editar dados nem Corretores autorizados, mas salva observação', async () => {
    pode.gerir = false;
    own.salvarObservacoes.mockResolvedValue({ ...ficha, notes: 'ligar sexta' });
    abrir();
    await screen.findByText('Maria Souza');
    expect(screen.queryByRole('button', { name: 'Editar dados' })).toBeNull();
    expect(screen.queryByText('Corretores autorizados')).toBeNull();
    await userEvent.type(screen.getByLabelText('Observações internas'), 'ligar sexta');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar observações' }));
    await waitFor(() => expect(own.salvarObservacoes).toHaveBeenCalledWith('o1', 'ligar sexta'));
  });

  it('corretor abre os dados internos do imóvel pelo cartão', async () => {
    pode.gerir = false;
    imoveis.get.mockResolvedValue({ id: 'p1', code: 'AP0461', on_sign: true, internal_info: { keys_location: 'Portaria' } });
    abrir();
    await userEvent.click(await screen.findByText('AP0461'));
    expect(await screen.findByText('Portaria')).toBeInTheDocument();
    expect(screen.getByText('Tem placa')).toBeInTheDocument();
  });
});
