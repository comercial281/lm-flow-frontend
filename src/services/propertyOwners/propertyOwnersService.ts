import api from '@/services/core/api';

export type StatusDoProprietario = 'available' | 'has_changes' | 'unavailable' | 'no_response';
export type OrigemDoProprietario = 'manual' | 'site_capture' | 'ai';
export interface Pessoa { id: string; name: string }
export interface Proprietario {
  id: string; name: string; phone: string | null; phone_secondary: string | null; email: string | null;
  document: string | null; status: StatusDoProprietario; source: OrigemDoProprietario; notes: string | null;
  captor: Pessoa | null; authorized_users: Pessoa[]; status_changed_at: string | null; status_changed_by: Pessoa | null;
  properties: { id: string; code: string }[]; created_at: string; updated_at: string;
}
export interface ImovelDoProprietario { id: string; code: string; title: string; listing_kind: 'development' | 'resale'; status: string; display_price: string | null; cover_photo_url: string | null }
export interface MudancaDeStatus { from: StatusDoProprietario | null; to: StatusDoProprietario; user: Pessoa | null; at: string }
export interface ProprietarioCompleto extends Omit<Proprietario, 'properties'> { properties: ImovelDoProprietario[]; history: MudancaDeStatus[] }
export interface DadosDoProprietario { name: string; phone?: string; phone_secondary?: string; email?: string; document?: string; notes?: string; captor_id?: string | null; authorized_user_ids?: string[] }

const BASE = '/property_owners';

export const propertyOwnersService = {
  async list(params: { q?: string; status?: StatusDoProprietario; page?: number; per_page?: number } = {}) {
    const { data } = await api.get(BASE, { params });
    return data as { data: Proprietario[]; meta: { total: number; page: number; per_page: number } };
  },
  async count(): Promise<number> {
    const { data } = await api.get(`${BASE}/count`);
    return Number(data?.data?.count ?? 0);
  },
  async get(id: string): Promise<ProprietarioCompleto> {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.data;
  },
  async create(dados: DadosDoProprietario): Promise<ProprietarioCompleto> {
    const { data } = await api.post(BASE, { property_owner: dados });
    return data.data;
  },
  async update(id: string, dados: Partial<DadosDoProprietario>): Promise<ProprietarioCompleto> {
    const { data } = await api.put(`${BASE}/${id}`, { property_owner: dados });
    return data.data;
  },
  async remove(id: string): Promise<void> { await api.delete(`${BASE}/${id}`); },
  async mudarStatus(id: string, status: StatusDoProprietario): Promise<ProprietarioCompleto> {
    const { data } = await api.patch(`${BASE}/${id}/status`, { status });
    return data.data;
  },
  async salvarObservacoes(id: string, notes: string): Promise<ProprietarioCompleto> {
    const { data } = await api.patch(`${BASE}/${id}/notes`, { notes });
    return data.data;
  },
};
