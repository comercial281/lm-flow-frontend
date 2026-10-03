import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act } from 'react';

const own = vi.hoisted(() => ({ list: vi.fn(), mudarStatus: vi.fn(), count: vi.fn(), create: vi.fn() }));
const cap = vi.hoisted(() => ({ list: vi.fn() }));
const pode = vi.hoisted(() => ({ gerir: true }));
const perfil = vi.hoisted(() => ({ updateUISettings: vi.fn() }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: own }));
vi.mock('@/services/propertyCaptureRequests/propertyCaptureRequestsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyCaptureRequests/propertyCaptureRequestsService')>();
  return { ...real, propertyCaptureRequestsService: { ...real.propertyCaptureRequestsService, ...cap } };
});
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => (r === 'properties' && a === 'update' ? pode.gerir : true) }));
// O serviço que grava ui_settings de verdade (o de '@/services/auth' não é usado no app).
vi.mock('@/services/profile/profileService', () => ({ profileService: perfil }));
vi.mock('./NovasCaptacoes', () => ({ default: () => <p>lista de captações</p> }));
import GestaoDeProprietarios from './GestaoDeProprietarios';
import { useAuthStore } from '@/store/authStore';

const maria = { id: 'o1', name: 'Maria Souza', phone: '11999998888', status: 'available', source: 'site_capture',
  properties: [{ id: 'p1', code: 'AP0461' }], status_changed_at: '2026-10-02T10:00:00Z', status_changed_by: { id: 'u1', name: 'Ivan' },
  authorized_users: [], captor: null, email: null, document: null, notes: null, phone_secondary: null, created_at: '', updated_at: '' };

beforeEach(() => {
  vi.clearAllMocks(); pode.gerir = true;
  own.list.mockResolvedValue({ data: [maria], meta: { total: 1 } });
  cap.list.mockResolvedValue({ data: [], meta: { total: 2 } });
  perfil.updateUISettings.mockResolvedValue({});
  useAuthStore.setState({ currentUser: null });
});

function Onde() { return <p data-testid="onde">{useLocation().pathname}</p>; }
const abrir = (url = '/property-owners') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/property-owners" element={<GestaoDeProprietarios />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

describe('GestaoDeProprietarios', () => {
  it('linha com origem, código, atualização e status', async () => {
    abrir();
    const linha = (await screen.findByText('Maria Souza')).closest('[data-testid="linha-proprietario"]') as HTMLElement;
    expect(within(linha).getByText('Captação do site')).toBeInTheDocument();
    expect(within(linha).getByRole('link', { name: 'AP0461' })).toBeInTheDocument();
    expect(within(linha).getByText(/por Ivan/)).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: 'Status: Disponível' })).toBeInTheDocument();
  });

  it('troca status pela pílula', async () => {
    own.mudarStatus.mockResolvedValue({ ...maria, status: 'unavailable' });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Status: Disponível' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Indisponível' }));
    await waitFor(() => expect(own.mudarStatus).toHaveBeenCalledWith('o1', 'unavailable'));
    expect(await screen.findByRole('button', { name: 'Status: Indisponível' })).toBeInTheDocument();
  });

  it('erro ao trocar status volta a pílula', async () => {
    own.mudarStatus.mockRejectedValue(new Error('rede'));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Status: Disponível' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sem resposta' }));
    await waitFor(() => expect(own.mudarStatus).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Status: Disponível' })).toBeInTheDocument();
  });

  it('clicar na linha abre a ficha', async () => {
    abrir();
    await userEvent.click(await screen.findByText('Captação do site'));
    expect(screen.getByTestId('onde')).toHaveTextContent('/property-owners/o1');
  });

  it('aba Novas captações tem bolinha quando há pedido novo', async () => {
    abrir();
    const aba = await screen.findByRole('tab', { name: /Novas captações/ });
    await waitFor(() => expect(within(aba).getByLabelText('Novidade')).toBeInTheDocument());
  });

  it('abrir Novas captações marca como vistas', async () => {
    abrir('/property-owners?aba=captacoes');
    expect(await screen.findByText('lista de captações')).toBeInTheDocument();
    await waitFor(() => expect(perfil.updateUISettings).toHaveBeenCalledWith(
      expect.objectContaining({ captacoes_vistas_ate: expect.any(String) }),
    ));
  });

  it('com a aba aberta, pedido que chega depois também conta como visto', async () => {
    useAuthStore.setState({ currentUser: { id: 'u1', ui_settings: { font_size: 'large' } } as never });
    let novos = 0;
    cap.list.mockImplementation(async (p: Record<string, string>) => (p.created_after
      ? { data: [], meta: { total: novos } }
      : { data: [{ id: 'c1', created_at: '2026-10-03T12:00:00.000Z' }], meta: { total: 2 } }));
    abrir('/property-owners?aba=captacoes');
    await waitFor(() => expect(perfil.updateUISettings).toHaveBeenCalledTimes(1));
    expect(perfil.updateUISettings).toHaveBeenLastCalledWith({ font_size: 'large', captacoes_vistas_ate: '2026-10-03T12:00:00.001Z' });
    novos = 1;
    // A bolinha acende de novo (conferência ao voltar para a aba do navegador)...
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    // ...e, com a aba aberta, se apaga sozinha.
    await waitFor(() => expect(perfil.updateUISettings).toHaveBeenCalledTimes(2));
    novos = 0;
    await waitFor(() => expect(screen.getByRole('tab', { name: /Novas captações/ }).querySelector('[data-marcador]')).toBeNull());
  });

  it('corretor não vê Novo proprietário', async () => {
    pode.gerir = false;
    abrir();
    await screen.findByText('Maria Souza');
    expect(screen.queryByRole('button', { name: 'Novo proprietário' })).toBeNull();
  });

  it('lista vazia do corretor diz que nada foi liberado', async () => {
    pode.gerir = false;
    own.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    abrir();
    expect(await screen.findByText('Nenhum proprietário liberado para você')).toBeInTheDocument();
  });

  it('busca espera e manda o termo', async () => {
    abrir();
    await screen.findByText('Maria Souza');
    own.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar proprietário' }), 'zé');
    await waitFor(() => expect(own.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'zé', page: 1, per_page: 50 })));
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
  });

  it('Novo proprietário avisa telefone repetido e, ao criar, vai para a ficha', async () => {
    own.create.mockResolvedValue({ ...maria, id: 'o9', name: 'João' });
    abrir();
    await screen.findByText('Maria Souza');
    await userEvent.click(screen.getByRole('button', { name: 'Novo proprietário' }));
    const janela = await screen.findByRole('dialog');
    await userEvent.type(within(janela).getByLabelText('Nome'), 'João');
    await userEvent.type(within(janela).getByLabelText('Telefone'), '11999998888');
    expect(await within(janela).findByText('Já existe um proprietário com esse telefone')).toBeInTheDocument();
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(own.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'João', phone: '11999998888' })));
    expect(await screen.findByTestId('onde')).toHaveTextContent('/property-owners/o9');
  });
});
