import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ update: vi.fn(), getNextUp: vi.fn() }));
const users = vi.hoisted(() => ({ getUsers: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/users/usersService', () => ({ default: users }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
import FilaBloco from './FilaBloco';
import type { RoletaConfig } from '@/services/roletaConfig/roletaConfigService';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const membro = (user_id: string, name: string, position: number, extra = {}) => ({
  user_id, name, position, is_active: true, weight: 10, personal_whatsapp_number: '', ...extra,
});
const roleta = (extra: Partial<RoletaConfig> = {}) => ({
  id: 'r1', is_active: true, timeout_minutes: 10, business_hours_config: {},
  members: [
    membro('u2', 'Renê', 1, { phone_display: '(11) 97331-3240', phone_status: 'disconnected' }),
    membro('u1', 'Bruno', 0, { phone_display: '(11) 98888-7777', phone_status: 'connected' }),
    membro('u3', 'Carla', 2, { phone_status: 'none', is_active: false }),
  ],
  ...extra,
}) as unknown as RoletaConfig;

const aoMudar = vi.fn();
const abrir = (r = roleta()) => render(<FilaBloco roleta={r} aoMudar={aoMudar} />);
const enviado = () => svc.update.mock.calls.at(-1)?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  svc.update.mockImplementation(async (_id: string, p: unknown) => ({ ...roleta(), ...(p as object) }));
  svc.getNextUp.mockResolvedValue({ user_id: 'u1', user_name: 'Bruno' });
  users.getUsers.mockResolvedValue({ data: [
    { id: 'u1', name: 'Bruno' }, { id: 'u4', name: 'Diana' }, { id: 'u5', name: 'Ex-corretor', deactivated: true },
  ] });
});

describe('Fila', () => {
  it('na ordem gravada, com posição, número e pausado', async () => {
    abrir();
    const linhas = within(screen.getByRole('list', { name: 'Fila da roleta' })).getAllByRole('listitem');
    expect(linhas[0]).toHaveTextContent('1º');
    expect(linhas[0]).toHaveTextContent('Bruno');
    expect(linhas[0]).toHaveTextContent('(11) 98888-7777 · conectado');
    expect(linhas[1]).toHaveTextContent('(11) 97331-3240 · desconectado');
    expect(linhas[2]).toHaveTextContent('Pausado: é pulado na fila');
    expect(await screen.findByText('Bruno', { selector: 'span.font-medium.text-foreground' })).toBeInTheDocument();
    expect(svc.getNextUp).toHaveBeenCalledWith('r1');
  });

  it('seta ↓ troca a ordem e grava a posição pelo índice', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Descer Bruno na fila' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(enviado().members.map((m: { user_id: string; position: number }) => [m.user_id, m.position]))
      .toEqual([['u2', 0], ['u1', 1], ['u3', 2]]);
    expect(aoMudar).toHaveBeenCalled();
  });

  it('a primeira não sobe e a última não desce', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Subir Bruno na fila' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer Carla na fila' })).toBeDisabled();
  });

  it('pausar vale na hora', async () => {
    abrir();
    await userEvent.click(screen.getByRole('switch', { name: 'Renê recebe leads' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(enviado().members.find((m: { user_id: string }) => m.user_id === 'u2').is_active).toBe(false);
    expect(toasts.success).toHaveBeenCalledWith('Renê pausado');
  });

  it('erro ao gravar volta a ordem e diz por quê', async () => {
    svc.update.mockRejectedValue({ response: { data: { error: 'Sem permissão' } } });
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Descer Bruno na fila' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Sem permissão'));
    const linhas = within(screen.getByRole('list', { name: 'Fila da roleta' })).getAllByRole('listitem');
    expect(linhas[0]).toHaveTextContent('Bruno');
  });

  it('tirar da fila', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Carla da fila' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(enviado().members.map((m: { user_id: string }) => m.user_id)).toEqual(['u1', 'u2']);
  });

  it('+ Adicionar corretor oferece só quem está ativo e fora da fila', async () => {
    abrir();
    const seletor = screen.getByRole('combobox', { name: 'Adicionar corretor' });
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(2));
    expect(within(seletor).queryByRole('option', { name: 'Bruno' })).toBeNull();
    expect(within(seletor).queryByRole('option', { name: 'Ex-corretor' })).toBeNull();
    await userEvent.selectOptions(seletor, 'u4');
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(enviado().members.at(-1)).toMatchObject({ user_id: 'u4', is_active: true, position: 3, personal_whatsapp_number: null });
  });

  it('prazo pra aceitar com as opções da casa e Sem prazo', async () => {
    abrir();
    const prazo = screen.getByLabelText('Prazo pra aceitar');
    expect(within(prazo).getAllByRole('option').map(o => o.textContent))
      .toEqual(['5 min', '10 min', '15 min', '30 min', '1 h', '2 h', 'Sem prazo']);
    await userEvent.selectOptions(prazo, '0');
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { timeout_minutes: 0 }));
  });

  it('prazo gravado fora das opções continua aparecendo', () => {
    abrir(roleta({ timeout_minutes: 7 }));
    expect(screen.getByLabelText('Prazo pra aceitar')).toHaveValue('7');
  });

  it('ninguém na vez: diz o motivo', async () => {
    svc.getNextUp.mockResolvedValue({ user_id: null, reason: 'Ninguém ativo na fila' });
    abrir();
    expect(await screen.findByText('Próximo agora: ninguém. Ninguém ativo na fila')).toBeInTheDocument();
  });

  it('fila vazia explica o que fazer', () => {
    abrir(roleta({ members: [] }));
    expect(screen.getByText(/Ninguém na fila ainda/)).toBeInTheDocument();
  });
});
