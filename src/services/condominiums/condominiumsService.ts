import api from '@/services/core/api';
import { criarServicoDeFotos } from '@/services/propertyPhotos/propertyPhotosService';

// Condomínios: cadastro único do prédio/condomínio, com unidades plugadas.
// Backend: /api/v1/condominiums (lm-flow, PR #599). Respostas embrulhadas em { data }.

export type CondominiumKind = 'vertical' | 'horizontal' | 'commercial';

export const ROTULO_DO_TIPO: Record<CondominiumKind, string> = {
  vertical: 'Prédio',
  horizontal: 'Condomínio de casas',
  commercial: 'Comercial',
};

export interface CondominiumContact {
  name: string;
  role: 'zelador' | 'porteiro' | 'sindico' | 'administradora' | 'outro';
  phone: string;
  email: string;
}

/** Linha da lista. */
export interface CondominiumRow {
  id: string;
  name: string;
  kind: CondominiumKind;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  units_count: number;
  for_sale_count: number;
  sold_count: number;
  updated_at: string;
  cover_photo_url: string | null;
}

export interface CondominiumUnit {
  id: string;
  code: string;
  title: string;
  status: string;
  listing_kind: string;
}

/** Cadastro completo. */
export interface Condominium extends CondominiumRow {
  builder_name: string | null;
  developer_name: string | null;
  administrator_name: string | null;
  year_built: number | null;
  internal_note: string | null;
  address_cep: string | null;
  address_complement: string | null;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  condo_features: string[];
  contacts: CondominiumContact[];
  locked_fields: string[];
  photos_count: number;
  units: CondominiumUnit[];
}

/** Campos editáveis (nomes iguais aos do servidor). */
export interface CondominiumFormData {
  name: string;
  kind: CondominiumKind;
  builder_name?: string | null;
  developer_name?: string | null;
  administrator_name?: string | null;
  year_built?: number | null;
  internal_note?: string | null;
  address_cep?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_source?: string | null;
  condo_features?: string[];
  contacts?: CondominiumContact[];
}

export interface CondominiumsListParams {
  q?: string;
  city?: string;
  page?: number;
  per_page?: number;
}

export interface CondominiumsResponse {
  data: CondominiumRow[];
  meta: { total: number; page: number; per_page: number; cities: string[] };
}

const base = '/condominiums';

// O id entra codificado: nunca vira pedaço de caminho nem parâmetro.
const caminho = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const condominiumsService = {
  async list(params: CondominiumsListParams = {}): Promise<CondominiumsResponse> {
    const res = await api.get(base, { params });
    return res.data as CondominiumsResponse;
  },

  async get(id: string): Promise<Condominium> {
    const res = await api.get(caminho(id));
    return (res.data as { data: Condominium }).data;
  },

  async create(data: CondominiumFormData): Promise<Condominium> {
    const res = await api.post(base, { condominium: data });
    return (res.data as { data: Condominium }).data;
  },

  async update(id: string, data: Partial<CondominiumFormData>): Promise<Condominium> {
    const res = await api.put(caminho(id), { condominium: data });
    return (res.data as { data: Condominium }).data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(caminho(id));
  },

  fotos: criarServicoDeFotos(id => `${caminho(id)}/photos`),
};
