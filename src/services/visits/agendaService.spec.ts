import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { agendaService } from './agendaService';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const HORARIO = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} };

describe('agendaService: horário de visita', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /visit_settings, com ou sem o envelope { data }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, data: HORARIO } } as never);
    expect(await agendaService.getSettings()).toEqual(HORARIO);
    expect(api.get).toHaveBeenCalledWith('/visit_settings');

    vi.mocked(api.get).mockResolvedValueOnce({ data: HORARIO } as never);
    expect(await agendaService.getSettings()).toEqual(HORARIO);
  });

  it('chave desligada: { enabled: false }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, data: { enabled: false } } } as never);
    expect(await agendaService.getSettings()).toEqual({ enabled: false });
  });

  it('PUT /visit_settings só com os quatro campos', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: HORARIO } } as never);
    const r = await agendaService.updateSettings({ days: [1, 2], start: '09:00', end: '18:00', closed_dates: ['2026-10-12'] });
    expect(api.put).toHaveBeenCalledWith('/visit_settings', { days: [1, 2], start: '09:00', end: '18:00', closed_dates: ['2026-10-12'] });
    expect(r).toEqual(HORARIO);
  });
});

describe('agendaService: folgas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /realtor_time_offs com os filtros, lista com ou sem envelope', async () => {
    const folga = { id: 'f1', user_id: 'u1', user_name: 'Ana Teste', starts_on: '2026-10-07', ends_on: '2026-10-07', start_time: null, end_time: null, note: null };
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [folga] } } as never);
    expect(await agendaService.listTimeOffs({ from: '2026-10-01' })).toEqual([folga]);
    expect(api.get).toHaveBeenCalledWith('/realtor_time_offs', { params: { from: '2026-10-01' } });

    vi.mocked(api.get).mockResolvedValueOnce({ data: [folga] } as never);
    expect(await agendaService.listTimeOffs()).toEqual([folga]);
  });

  it('POST /realtor_time_offs manda os horários nulos no dia inteiro', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'f2' } } } as never);
    await agendaService.createTimeOff({ user_id: 'u1', starts_on: '2026-10-07', ends_on: '2026-10-07', start_time: null, end_time: null });
    expect(api.post).toHaveBeenCalledWith('/realtor_time_offs', {
      user_id: 'u1', starts_on: '2026-10-07', ends_on: '2026-10-07', start_time: null, end_time: null,
    });
  });

  it('DELETE /realtor_time_offs/:id', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} } as never);
    await agendaService.removeTimeOff('f1');
    expect(api.delete).toHaveBeenCalledWith('/realtor_time_offs/f1');
  });
});

describe('agendaService.availability', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /visits/availability com corretor, dia e duração', async () => {
    const resp = { enabled: true, day: { open: true, reason: null, reason_text: null }, slots: [] };
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: resp } } as never);
    const r = await agendaService.availability({ realtor_id: 'u1', date: '2026-10-07', duration: 60 });
    expect(api.get).toHaveBeenCalledWith('/visits/availability', { params: { realtor_id: 'u1', date: '2026-10-07', duration: 60 } });
    expect(r).toEqual(resp);
  });
});
