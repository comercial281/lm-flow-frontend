import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ get: vi.fn(), getOrigins: vi.fn(), update: vi.fn(), duplicate: vi.fn(), destroy: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
vi.mock('./blocos/OrigensBloco', () => ({ default: ({ origens }: { origens: unknown[] }) => <p>origens: {origens.length}</p> }));
vi.mock('./blocos/FilaBloco', () => ({ default: () => <p>bloco da fila</p> }));
vi.mock('./blocos/HorarioBloco', () => ({ default: () => <p>bloco do horário</p> }));
vi.mock('./HistoricoLista', () => ({ default: ({ roletaId }: { roletaId?: string }) => <p>histórico da roleta {roletaId}</p> }));
import RoletaPagina from './RoletaPagina';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }

const roleta = (extra = {}) => ({
  id: 'r1', name: 'Team Pinot', display_name: 'Team Pinot', is_active: false, timeout_minutes: 10,
  business_hours_config: {}, members: [{ user_id: 'u1', is_active: true, weight: 10, position: 0, personal_whatsapp_number: '' }],
  ...extra,
});
const origem = { kind: 'landing', ref_id: 'l1', label: 'Lançamento Alma' };

const abrir = (endereco = '/automations/roleta-config/r1') => render(
  <MemoryRouter initialEntries={[endereco]}>
    <Routes>
      <Route path="/automations/roleta-config/:id" element={<><RoletaPagina /><Onde /></>} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

// O balão do botão de ícone (Radix) mede o tamanho com o ResizeObserver, que o jsdom não tem.
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  svc.get.mockResolvedValue(roleta());
  svc.getOrigins.mockResolvedValue([origem]);
});

describe('página da roleta', () => {
  it('cabeçalho, volta pra lista e os três blocos com respiro', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Team Pinot' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Roleta de leads' })).toHaveAttribute('href', '/automations/roleta-config');
    expect(screen.getByRole('heading', { name: 'De onde vem o lead' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fila' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quando funciona' })).toBeInTheDocument();
    expect(screen.getByText('origens: 1')).toBeInTheDocument();
    expect(svc.get).toHaveBeenCalledWith('r1');
  });

  it('sem origem, a chave fica travada e diz o que falta', async () => {
    svc.getOrigins.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText('Falta: uma origem')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ligar a roleta' })).toBeDisabled();
  });

  it('sem corretor ativo, também trava', async () => {
    svc.get.mockResolvedValue(roleta({ members: [{ user_id: 'u1', is_active: false }] }));
    abrir();
    expect(await screen.findByText('Falta: um corretor ativo na fila')).toBeInTheDocument();
  });

  it('com origem e corretor ativo, liga na hora', async () => {
    svc.update.mockResolvedValue(roleta({ is_active: true }));
    abrir();
    const chave = await screen.findByRole('switch', { name: 'Ligar a roleta' });
    expect(chave).toBeEnabled();
    await userEvent.click(chave);
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { is_active: true }));
  });

  it('servidor recusa ligar: volta e mostra a frase dele', async () => {
    svc.update.mockRejectedValue({ response: { status: 422, data: { error: 'Falta: uma origem' } } });
    abrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Ligar a roleta' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Falta: uma origem'));
    expect(screen.getByRole('switch', { name: 'Ligar a roleta' })).not.toBeChecked();
  });

  it('ligada pode desligar mesmo faltando algo', async () => {
    svc.get.mockResolvedValue(roleta({ is_active: true }));
    svc.getOrigins.mockResolvedValue([]);
    abrir();
    expect(await screen.findByRole('switch', { name: 'Ligar a roleta' })).toBeEnabled();
    expect(screen.queryByText('Falta: uma origem')).toBeNull();
  });

  it('nome editável no lugar: Enter grava', async () => {
    svc.update.mockResolvedValue(roleta({ name: 'Zona Sul', display_name: 'Zona Sul' }));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Mudar o nome' }));
    const campo = screen.getByLabelText('Nome da roleta');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Zona Sul{Enter}');
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { name: 'Zona Sul' }));
    expect(await screen.findByRole('heading', { name: 'Zona Sul' })).toBeInTheDocument();
    expect(svc.update).toHaveBeenCalledTimes(1);
  });

  it('Esc desiste do nome sem gravar', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Mudar o nome' }));
    await userEvent.type(screen.getByLabelText('Nome da roleta'), ' X{Escape}');
    expect(screen.getByRole('heading', { name: 'Team Pinot' })).toBeInTheDocument();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('Duplicar abre a cópia', async () => {
    svc.duplicate.mockResolvedValue({ id: 'r2', name: 'Cópia de Team Pinot', display_name: 'Cópia de Team Pinot' });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/automations/roleta-config/r2'));
    expect(toasts.success).toHaveBeenCalledWith('Cópia criada: Cópia de Team Pinot');
  });

  it('Excluir pede confirmação e volta pra lista', async () => {
    svc.destroy.mockResolvedValue(undefined);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações da roleta' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir roleta' }));
    const dialogo = await screen.findByRole('dialog');
    expect(svc.destroy).not.toHaveBeenCalled();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent(/^\/automations\/roleta-config$/));
    expect(svc.destroy).toHaveBeenCalledWith('r1');
  });

  it('aba Histórico mora no endereço', async () => {
    abrir('/automations/roleta-config/r1?aba=historico');
    expect(await screen.findByText('histórico da roleta r1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Como funciona' }));
    expect(screen.getByText('bloco da fila')).toBeInTheDocument();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    svc.get.mockRejectedValueOnce(new Error('rede'));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Team Pinot' })).toBeInTheDocument();
  });
});
