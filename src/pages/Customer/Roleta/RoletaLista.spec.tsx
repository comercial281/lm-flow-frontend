import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ getAll: vi.fn(), createDraft: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
vi.mock('./HistoricoLista', () => ({ default: () => <p>histórico geral</p> }));
vi.mock('./AvisosAba', () => ({ default: () => <p>aba de avisos</p> }));
import RoletaLista from './RoletaLista';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }

const roleta = {
  id: 'r1', name: 'Team Pinot', display_name: 'Team Pinot', is_active: true, timeout_minutes: 10,
  business_hours_config: { mode: 'custom', windows: [{ start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] }] },
  origins_summary: ['Formulários "ZONA SUL", "ZONA OESTE"'],
  members: [{ user_id: 'u1', is_active: true }, { user_id: 'u2', is_active: true }],
  pending_count: 2, exhausted_count_7d: 1,
};

const abrir = (endereco = '/automations/roleta-config') => render(
  <MemoryRouter initialEntries={[endereco]}>
    <Routes>
      <Route path="/automations/roleta-config" element={<><RoletaLista /><Onde /></>} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { vi.clearAllMocks(); svc.getAll.mockResolvedValue([roleta]); });

describe('Roleta de leads (lista)', () => {
  it('cartão lido como frase, com selo e linha de atenção', async () => {
    abrir();
    expect(await screen.findByText('Team Pinot')).toBeInTheDocument();
    expect(screen.getByText('Ligada')).toBeInTheDocument();
    expect(screen.getByText('Formulários "ZONA SUL", "ZONA OESTE" → 2 corretores na fila')).toBeInTheDocument();
    expect(screen.getByText('10 min pra aceitar · Seg a Sáb, 8h–20h')).toBeInTheDocument();
    expect(screen.getByText('2 esperando aceite · 1 ninguém aceitou')).toBeInTheDocument();
  });

  it('cartão inteiro leva pra página da roleta', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('link', { name: 'Abrir a roleta Team Pinot' }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/automations/roleta-config/r1');
  });

  it('sem nada pra olhar, a linha de atenção some; desligada mostra o selo', async () => {
    svc.getAll.mockResolvedValue([{ ...roleta, is_active: false, pending_count: 0, exhausted_count_7d: 0 }]);
    abrir();
    expect(await screen.findByText('Desligada')).toBeInTheDocument();
    expect(screen.queryByText(/esperando aceite/)).toBeNull();
  });

  it('estado vazio explica e oferece criar', async () => {
    svc.getAll.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText('Nenhuma roleta ainda')).toBeInTheDocument();
    expect(screen.getByText(/A roleta decide qual corretor atende cada lead/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova roleta' }).length).toBeGreaterThan(0);
  });

  it('erro ao carregar não vira lista vazia', async () => {
    svc.getAll.mockRejectedValue(new Error('rede'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma roleta ainda')).toBeNull();
  });

  it('Nova roleta cria desligada só com o nome e abre a página dela', async () => {
    svc.createDraft.mockResolvedValue({ id: 'r9', name: 'Zona Sul' });
    abrir();
    await screen.findByText('Team Pinot');
    await userEvent.click(screen.getByRole('button', { name: 'Nova roleta' }));
    const criar = screen.getByRole('button', { name: 'Criar' });
    expect(criar).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nome da roleta'), 'Zona Sul');
    await userEvent.click(criar);
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/automations/roleta-config/r9'));
    expect(svc.createDraft).toHaveBeenCalledWith('Zona Sul');
  });

  it('as abas moram no endereço', async () => {
    abrir('/automations/roleta-config?aba=avisos');
    expect(screen.getByText('aba de avisos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(screen.getByText('histórico geral')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent('?aba=historico');
    await userEvent.click(screen.getByRole('tab', { name: 'Roletas' }));
    expect(await screen.findByText('Team Pinot')).toBeInTheDocument();
  });
});
