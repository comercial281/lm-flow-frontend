import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ getHistory: vi.fn(), getAll: vi.fn(), redistributeExhausted: vi.fn() }));
const users = vi.hoisted(() => ({ getUsers: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const permissao = vi.hoisted(() => ({ assign: true }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/users/usersService', () => ({ default: users }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (_r: string, a: string) => (a === 'assign' ? permissao.assign : true) }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
import HistoricoLista from './HistoricoLista';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

function Onde() { return <p data-testid="onde">{useLocation().pathname}</p>; }

const item = (extra = {}) => ({
  contact_id: 'c1', contact_name: 'Maria Silva', pipeline_item_id: 'p1', conversation_id: null,
  origin_label: 'Form. ZONA SUL', status: 'accepted', status_label: 'Aceito por Renê · 09:12', user_name: 'Renê',
  at: '2026-10-06T12:00:00Z', can_redistribute: false, roleta_name: 'Team Pinot',
  steps: [{ at: '2026-10-06T12:00:00Z', label: 'Ofertado a Bruno' }, { at: '2026-10-06T12:12:00Z', label: 'Aceito por Renê' }],
  ...extra,
});

const abrir = (roletaId?: string) => render(
  <MemoryRouter initialEntries={['/automations/roleta-config']}>
    <Routes>
      <Route path="/automations/roleta-config" element={<HistoricoLista roletaId={roletaId} />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  permissao.assign = true;
  svc.getHistory.mockResolvedValue([item()]);
  svc.getAll.mockResolvedValue([{ id: 'r1', name: 'Team Pinot', display_name: 'Team Pinot' }, { id: 'r2', name: 'Zona Norte' }]);
  users.getUsers.mockResolvedValue({ data: [{ id: 'u1', name: 'Bruno' }] });
});

describe('Histórico da roleta', () => {
  it('de uma roleta: sem coluna Roleta, filtros padrão', async () => {
    abrir('r1');
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Aceito por Renê · 09:12')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Roleta' })).toBeNull();
    expect(svc.getHistory).toHaveBeenCalledWith({ roletaId: 'r1', filter: 'all', userId: null, days: 7 });
    expect(screen.queryByRole('combobox', { name: 'Roleta' })).toBeNull();
  });

  it('geral: coluna e filtro da roleta (escolher uma usa o histórico dela)', async () => {
    abrir();
    expect(await screen.findByRole('columnheader', { name: 'Roleta' })).toBeInTheDocument();
    expect(svc.getHistory).toHaveBeenCalledWith({ roletaId: null, filter: 'all', userId: null, days: 7 });
    const roleta = screen.getByRole('combobox', { name: 'Roleta' });
    await waitFor(() => expect(within(roleta).getAllByRole('option')).toHaveLength(3));
    await userEvent.selectOptions(roleta, 'r2');
    await waitFor(() => expect(svc.getHistory).toHaveBeenLastCalledWith({ roletaId: 'r2', filter: 'all', userId: null, days: 7 }));
  });

  it('filtros: precisa de atenção, corretor e período', async () => {
    abrir('r1');
    await screen.findByText('Maria Silva');
    await userEvent.click(screen.getByRole('radio', { name: 'Precisa de atenção' }));
    await waitFor(() => expect(svc.getHistory).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'attention' })));
    await waitFor(() => expect(within(screen.getByRole('combobox', { name: 'Corretor' })).getAllByRole('option')).toHaveLength(2));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Corretor' }), 'u1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Período' }), '30');
    await waitFor(() => expect(svc.getHistory).toHaveBeenLastCalledWith({ roletaId: 'r1', filter: 'attention', userId: 'u1', days: 30 }));
  });

  it('a linha abre o card do lead', async () => {
    abrir('r1');
    await userEvent.click(await screen.findByText('Form. ZONA SUL'));
    expect(screen.getByTestId('onde')).toHaveTextContent('/contacts/c1');
  });

  it('a setinha mostra o caminho, sem abrir o card', async () => {
    abrir('r1');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver o caminho de Maria Silva' }));
    const caminho = screen.getByRole('list', { name: 'Caminho de Maria Silva' });
    expect(within(caminho).getByText('Ofertado a Bruno')).toBeInTheDocument();
    expect(within(caminho).getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);
    expect(screen.queryByTestId('onde')).toBeNull();
  });

  it('ninguém aceitou: Sortear de novo, quando pode', async () => {
    svc.getHistory.mockResolvedValue([item({ status: 'exhausted', status_label: 'Ninguém aceitou', can_redistribute: true })]);
    svc.redistributeExhausted.mockResolvedValue({ corretor: 'Bruno' });
    abrir('r1');
    await userEvent.click(await screen.findByRole('button', { name: 'Sortear de novo' }));
    await waitFor(() => expect(svc.redistributeExhausted).toHaveBeenCalledWith('c1'));
    expect(toasts.success).toHaveBeenCalledWith('Lead sorteado de novo: oferecido a Bruno');
    expect(screen.queryByTestId('onde')).toBeNull();
  });

  it('sem poder (servidor ou cargo), o botão não aparece', async () => {
    svc.getHistory.mockResolvedValue([item({ status: 'exhausted', status_label: 'Ninguém aceitou', can_redistribute: false })]);
    abrir('r1');
    await screen.findByText('Ninguém aceitou');
    expect(screen.queryByRole('button', { name: 'Sortear de novo' })).toBeNull();
  });

  it('cargo sem sortear não vê o botão', async () => {
    permissao.assign = false;
    svc.getHistory.mockResolvedValue([item({ status: 'exhausted', status_label: 'Ninguém aceitou', can_redistribute: true })]);
    abrir('r1');
    await screen.findByText('Ninguém aceitou');
    expect(screen.queryByRole('button', { name: 'Sortear de novo' })).toBeNull();
  });

  it('vazio sem filtro explica; com filtro oferece limpar', async () => {
    svc.getHistory.mockResolvedValue([]);
    abrir('r1');
    expect(await screen.findByText('Nenhum lead ainda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Precisa de atenção' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('erro não vira lista vazia', async () => {
    svc.getHistory.mockRejectedValue(new Error('rede'));
    abrir('r1');
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
  });
});
