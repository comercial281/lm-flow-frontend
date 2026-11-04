// O corretor que cadastra já nasce Captador; o gestor segue escolhendo. E o corretor,
// que não lê a equipe, enxerga no seletor quem está no imóvel e o próprio nome.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const svc = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: () => Promise.resolve({ data: [] }) } }));
// Corretor não lê a equipe: o servidor recusa e a lista fica vazia.
const equipe = vi.hoisted(() => ({ getUsers: vi.fn() }));
vi.mock('@/services/users/usersService', () => ({ default: equipe }));
vi.mock('@/services/portals/portalsService', () => ({ portalsService: { list: () => Promise.resolve([]), get: vi.fn() } }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: { list: () => Promise.resolve({ data: [], meta: { total: 0 } }), get: vi.fn() } }));
vi.mock('./secoes/MapaDoCadastro', () => ({ default: () => null }));

import CadastroDoImovel from './CadastroDoImovel';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useAuthStore } from '@/store/authStore';

type Permissoes = { isReady: boolean; temTime: boolean; falhou?: boolean };

function abrir(url: string, p: Permissoes) {
  const tela = (v: Permissoes) => (
    <PermissionsContext.Provider
      value={{
        isReady: v.isReady,
        loadFailure: v.falhou ? 'network' : null,
        can: (r: string, a: string) => (`${r}.${a}` === 'dashboard.team' ? v.temTime : true),
      } as never}
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/properties/new" element={<CadastroDoImovel />} />
          <Route path="/properties/:id/editar" element={<CadastroDoImovel />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </PermissionsContext.Provider>
  );
  const r = render(tela(p));
  return { ...r, atualizar: (v: Permissoes) => r.rerender(tela(v)) };
}

const seletor = async (rotulo: string) => {
  const titulo = await screen.findByText(rotulo, { selector: 'label' });
  return within(titulo.parentElement as HTMLElement).getAllByRole('combobox')[0] as HTMLSelectElement;
};
const nomes = (s: HTMLSelectElement) => within(s).getAllByRole('option').map(o => o.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
  equipe.getUsers.mockRejectedValue(new Error('403'));
  useAuthStore.setState({ currentUser: { id: 'ana', name: 'Ana Souza', email: 'ana@exemplo.com' } as never });
});

describe('Captador no cadastro de imóvel', () => {
  it('corretor em imóvel novo já vem como Captador, e salva assim', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'resale' });
    abrir('/properties/new', { isReady: true, temTime: false });
    const s = await seletor('Captador');
    await waitFor(() => expect(s.value).toBe('ana'));
    expect(nomes(s)).toEqual(['Nenhum', 'Ana Souza']);
    await userEvent.type(screen.getByLabelText(/^Título/), 'Apartamento');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0].captor_id).toBe('ana');
  });

  it('corretor pode trocar para Nenhum, e salva sem captador', async () => {
    svc.create.mockResolvedValue({ id: 'n2', listing_kind: 'resale' });
    abrir('/properties/new', { isReady: true, temTime: false });
    const s = await seletor('Captador');
    await waitFor(() => expect(s.value).toBe('ana'));
    await userEvent.selectOptions(s, '');
    expect(s.value).toBe('');
    await userEvent.type(screen.getByLabelText(/^Título/), 'Apartamento');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0].captor_id ?? null).toBeNull();
  });

  it('abrir o cadastro e cancelar não pergunta se quer salvar', async () => {
    abrir('/properties/new', { isReady: true, temTime: false });
    const s = await seletor('Captador');
    await waitFor(() => expect(s.value).toBe('ana'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Captador', { selector: 'label' })).toBeNull());
    expect(screen.queryByText('Sair sem salvar?')).toBeNull();
  });

  it('editando, permissão que chega depois não marca o corretor como Captador', async () => {
    svc.get.mockResolvedValue({ id: 'i3', title: 'Apto', listing_kind: 'resale', captor_id: null, responsible_id: null });
    const t = abrir('/properties/i3/editar', { isReady: false, temTime: false });
    await seletor('Captador');
    t.atualizar({ isReady: true, temTime: false });
    await new Promise(r => setTimeout(r, 0));
    expect((await seletor('Captador')).value).toBe('');
  });

  it('escolha feita antes das permissões chegarem é respeitada', async () => {
    equipe.getUsers.mockResolvedValue({ data: [{ id: 'c', name: 'Carla' }] });
    const t = abrir('/properties/new', { isReady: false, temTime: false });
    const s = await seletor('Captador');
    await within(s).findByRole('option', { name: 'Carla' });
    await userEvent.selectOptions(s, 'c');
    t.atualizar({ isReady: true, temTime: false });
    await new Promise(r => setTimeout(r, 0));
    expect((await seletor('Captador')).value).toBe('c');
  });

  it('gestor em imóvel novo segue começando em Nenhum', async () => {
    equipe.getUsers.mockResolvedValue({ data: [{ id: 'ana', name: 'Ana Souza' }, { id: 'w', name: 'Carla' }] });
    abrir('/properties/new', { isReady: true, temTime: true });
    const s = await seletor('Captador');
    await within(s).findByRole('option', { name: 'Carla' });
    expect(s.value).toBe('');
    // Quem está na lista da equipe não aparece duas vezes.
    expect(nomes(s)).toEqual(['Nenhum', 'Ana Souza', 'Carla']);
  });

  it('não decide antes das permissões chegarem: gestor lento não vira Captador', async () => {
    const t = abrir('/properties/new', { isReady: false, temTime: false });
    const s = await seletor('Captador');
    expect(s.value).toBe('');
    t.atualizar({ isReady: true, temTime: true });
    expect((await seletor('Captador')).value).toBe('');
  });

  it('corretor cujas permissões chegam depois também é preenchido', async () => {
    const t = abrir('/properties/new', { isReady: false, temTime: false });
    await seletor('Captador');
    t.atualizar({ isReady: true, temTime: false });
    await waitFor(async () => expect((await seletor('Captador')).value).toBe('ana'));
  });

  it('falha ao ler as permissões não preenche ninguém', async () => {
    abrir('/properties/new', { isReady: true, temTime: false, falhou: true });
    expect((await seletor('Captador')).value).toBe('');
  });

  it('editando imóvel sem captador, o corretor pode se colocar', async () => {
    svc.get.mockResolvedValue({ id: 'i1', title: 'Apto', listing_kind: 'resale', captor_id: null, responsible_id: null });
    abrir('/properties/i1/editar', { isReady: true, temTime: false });
    const s = await seletor('Captador');
    expect(s.value).toBe('');
    expect(nomes(s)).toEqual(['Nenhum', 'Ana Souza']);
  });

  it('editando imóvel de outro captador, o corretor vê o nome dele e não se oferece', async () => {
    svc.get.mockResolvedValue({
      id: 'i2', title: 'Apto', listing_kind: 'resale',
      captor_id: 'w', captor: { id: 'w', name: 'Carla' },
      responsible_id: 'b', responsible: { id: 'b', name: 'Davi' },
    });
    abrir('/properties/i2/editar', { isReady: true, temTime: false });
    const c = await seletor('Captador');
    await waitFor(() => expect(c.value).toBe('w'));
    expect(nomes(c)).toEqual(['Nenhum', 'Carla']);
    const r = await seletor('Corretor responsável');
    expect(r.value).toBe('b');
    expect(nomes(r)).toEqual(['Nenhum', 'Davi']);
  });

  it('o corretor não se oferece como Corretor responsável (a chave manda lead direto pra ele)', async () => {
    abrir('/properties/new', { isReady: true, temTime: false });
    const r = await seletor('Corretor responsável');
    expect(nomes(r)).toEqual(['Nenhum']);
  });
});
