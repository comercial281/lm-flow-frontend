import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ update: vi.fn() }));
const inboxes = vi.hoisted(() => ({ list: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/channels/inboxesService', () => ({ default: inboxes }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
import HorarioBloco from './HorarioBloco';
import { limparPendentes, temAlteracaoPendente } from '@/hooks/useAlteracoesNaoSalvas';
import type { RoletaConfig } from '@/services/roletaConfig/roletaConfigService';

const roleta = (extra: Partial<RoletaConfig> = {}) => ({
  id: 'r1', is_active: true, timeout_minutes: 10, members: [],
  business_hours_config: { mode: 'always' },
  after_hours_message_enabled: false, after_hours_message: null, after_hours_inbox_id: null,
  ...extra,
}) as unknown as RoletaConfig;

const aoMudar = vi.fn();
const abrir = (r = roleta()) => render(<HorarioBloco roleta={r} aoMudar={aoMudar} />);

beforeEach(() => {
  vi.clearAllMocks();
  limparPendentes();
  inboxes.list.mockResolvedValue({ data: [
    { id: 'i1', name: 'Atendimento', connection_status: 'connected' },
    { id: 'i2', name: 'Número caído', connection_status: 'disconnected' },
  ] });
  svc.update.mockImplementation(async (_id: string, p: Record<string, unknown>) => roleta(p as Partial<RoletaConfig>));
});

describe('Quando funciona', () => {
  it('24 horas é o padrão e não pede nada', () => {
    abrir();
    expect(screen.getByRole('radio', { name: '24 horas' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Mandar mensagem pro lead enquanto isso')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();
  });

  it('só em alguns horários mostra as faixas e espera o Salvar', async () => {
    abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Só em alguns horários' }));
    expect(screen.getByText('Janela 1')).toBeInTheDocument();
    expect(temAlteracaoPendente()).toBe(true);
    const barra = screen.getByRole('region', { name: 'Alterações não salvas' });
    await userEvent.click(within(barra).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1].business_hours_config).toEqual({
      mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }],
    });
    expect(toasts.success).toHaveBeenCalledWith('Horário salvo');
  });

  it('voltar pra 24 horas manda mode always (não omite)', async () => {
    abrir(roleta({ business_hours_config: { mode: 'custom', windows: [{ start: '09:00', end: '18:00' }] } }));
    await userEvent.click(screen.getByRole('radio', { name: '24 horas' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update.mock.calls[0][1].business_hours_config).toEqual({ mode: 'always' }));
  });

  it('Descartar volta ao que estava', async () => {
    abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Só em alguns horários' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByRole('radio', { name: '24 horas' })).toHaveAttribute('aria-checked', 'true');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('a chave da mensagem vale na hora', async () => {
    abrir(roleta({ business_hours_config: { mode: 'custom', windows: [{ start: '08:00', end: '20:00' }] } }));
    await userEvent.click(screen.getByRole('switch', { name: 'Mandar mensagem pro lead enquanto isso' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { after_hours_message_enabled: true }));
  });

  it('ligada: número (só os conectados) e texto com botão de inserir', async () => {
    abrir(roleta({
      business_hours_config: { mode: 'custom', windows: [{ start: '08:00', end: '20:00' }] },
      after_hours_message_enabled: true,
    }));
    const numero = screen.getByLabelText('Número que manda a mensagem');
    await waitFor(() => expect(within(numero).getByRole('option', { name: 'Atendimento' })).toBeInTheDocument());
    expect(within(numero).queryByRole('option', { name: 'Número caído' })).toBeNull();
    expect(screen.getByText('Sem número e texto, a mensagem não sai.')).toBeInTheDocument();
    await userEvent.selectOptions(numero, 'i1');
    await userEvent.type(screen.getByLabelText('Mensagem'), 'Oi, ');
    await userEvent.click(screen.getByRole('button', { name: '+ Nome do lead' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ after_hours_inbox_id: 'i1', after_hours_message: 'Oi, {{nome}}' });
  });
});
