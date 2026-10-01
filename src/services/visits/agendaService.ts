/**
 * Agenda do corretor (agenda ligada no servidor): horário de visita da
 * imobiliária, folgas do corretor e horários livres de um dia.
 *
 * Quem pode o quê é decidido pelo SERVIDOR: o corretor isolado só lê e muda as
 * folgas dele, não muda o horário de visita (403) e, na disponibilidade, é
 * sempre ele mesmo. Com a agenda desligada, `getSettings` e `availability`
 * devolvem `{ enabled: false }`.
 *
 * O servidor responde no envelope `{ success, data }`; `semEnvelope` aceita
 * também o corpo cru, para a tela não quebrar se o envelope mudar.
 */
import api from '@/services/core/api';
import type { AgendaSettings, TimeOff } from '@/features/visits/agenda';

export type { AgendaSettings, TimeOff } from '@/features/visits/agenda';

export type SettingsResponse = { enabled: false } | ({ enabled: true } & AgendaSettings);

export interface SettingsPayload {
  days: number[];
  start: string;
  end: string;
  closed_dates: string[];
}

export interface TimeOffPayload {
  /** Só o gestor manda; para o corretor o servidor força ele mesmo. */
  user_id?: string;
  starts_on: string;
  ends_on: string;
  /** Os dois nulos = dia inteiro. */
  start_time: string | null;
  end_time: string | null;
  note?: string | null;
}

export interface AvailabilitySlot {
  at: string;
  label: string;
  state: 'free' | 'busy' | 'time_off';
  client_name: string | null;
}

export type AvailabilityResponse =
  | { enabled: false }
  | {
      enabled: true;
      day: { open: boolean; reason: null | 'weekday' | 'closed_date' | 'time_off'; reason_text: string | null };
      slots: AvailabilitySlot[];
    };

function semEnvelope<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const agendaService = {
  async getSettings(): Promise<SettingsResponse> {
    const res = await api.get('/visit_settings');
    return semEnvelope<SettingsResponse>(res.data);
  },

  async updateSettings(payload: SettingsPayload): Promise<SettingsResponse> {
    const { days, start, end, closed_dates } = payload;
    const res = await api.put('/visit_settings', { days, start, end, closed_dates });
    return semEnvelope<SettingsResponse>(res.data);
  },

  async listTimeOffs(params: { user_id?: string; from?: string; until?: string } = {}): Promise<TimeOff[]> {
    const res = await api.get('/realtor_time_offs', { params });
    return semEnvelope<TimeOff[]>(res.data) ?? [];
  },

  async createTimeOff(payload: TimeOffPayload): Promise<TimeOff> {
    const res = await api.post('/realtor_time_offs', payload);
    return semEnvelope<TimeOff>(res.data);
  },

  async removeTimeOff(id: string): Promise<void> {
    await api.delete(`/realtor_time_offs/${id}`);
  },

  async availability(params: { realtor_id?: string; date: string; duration: number }): Promise<AvailabilityResponse> {
    const res = await api.get('/visits/availability', { params });
    return semEnvelope<AvailabilityResponse>(res.data);
  },
};
