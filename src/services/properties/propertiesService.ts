import api from '@/services/core/api';

export interface Property {
  id: string;
  code: string;
  title: string;
  description?: string;
  transaction_type: 'sale' | 'rent' | 'sale_rent' | 'season';
  category_type: 'residential' | 'commercial' | 'industrial' | 'rural' | 'corporate';
  property_type: string;
  status: 'draft' | 'active' | 'reserved' | 'sold' | 'rented' | 'inactive';
  stage: 'ready' | 'in_construction' | 'launch' | 'pre_launch';
  sale_price?: number | null;
  rent_price?: number | null;
  condo_fee?: number | null;
  iptu?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  suites?: number | null;
  parking_spaces?: number | null;
  useful_area_m2?: number | null;
  total_area_m2?: number | null;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  latitude?: number | null;
  longitude?: number | null;
  exclusive?: boolean;
  featured?: boolean;
  published_on_site?: boolean;
  display_price?: string;
  full_address?: string;
  icon_summary?: {
    bedrooms: number;
    bathrooms: number;
    suites: number;
    parking: number;
    useful_area_m2: number;
    total_area_m2: number;
  };
  responsible?: { id: string; name: string } | null;
  captor?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyFormData {
  code?: string;
  title: string;
  description?: string;
  transaction_type: string;
  category_type: string;
  property_type: string;
  status: string;
  stage: string;
  sale_price?: number | null;
  rent_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  suites?: number | null;
  parking_spaces?: number | null;
  useful_area_m2?: number | null;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  exclusive?: boolean;
  featured?: boolean;
}

export interface PropertiesListParams {
  q?: string;
  status?: string;
  transaction_type?: string;
  property_type?: string;
  city?: string;
  page?: number;
  per_page?: number;
}

export interface PropertiesResponse {
  data: Property[];
  meta: { total: number; page: number; per_page: number };
}

export const propertiesService = {
  async list(params: PropertiesListParams = {}): Promise<PropertiesResponse> {
    const res = await api.get('/properties', { params });
    return res.data as PropertiesResponse;
  },

  async get(id: string): Promise<Property> {
    const res = await api.get(`/properties/${id}`);
    return (res.data as { data: Property }).data;
  },

  async create(data: PropertyFormData): Promise<Property> {
    const res = await api.post('/properties', { property: data });
    return (res.data as { data: Property }).data;
  },

  async update(id: string, data: Partial<PropertyFormData>): Promise<Property> {
    const res = await api.put(`/properties/${id}`, { property: data });
    return (res.data as { data: Property }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/properties/${id}`);
  },

  async generateDescription(
    id: string,
    opts: { tone?: string; audience?: string; focus?: string; apply?: boolean } = {}
  ): Promise<{ headline: string; description: string; highlights: string[] }> {
    const res = await api.post(`/properties/${id}/generate_description`, opts);
    return (res.data as { data: { headline: string; description: string; highlights: string[] } }).data;
  },

  async calculateScore(id: string): Promise<{ score: number; label: string; breakdown: Record<string, number> }> {
    const res = await api.post(`/properties/${id}/calculate_score`);
    return (res.data as { data: { score: number; label: string; breakdown: Record<string, number> } }).data;
  },

  async cepLookup(cep: string): Promise<{
    logradouro: string; bairro: string; localidade: string; uf: string;
  }> {
    const res = await api.get('/properties/cep_lookup', { params: { cep } });
    return (res.data as { data: Record<string, string> }).data as {
      logradouro: string; bairro: string; localidade: string; uf: string;
    };
  },

  async batchGenerateDescriptions(ids: string[]): Promise<Array<{
    id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
  }>> {
    const res = await api.post('/properties/batch_generate_descriptions', { ids });
    return (res.data as { data: Array<{ id: string; status: string; headline?: string; description?: string; error?: string }> }).data as Array<{
      id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
    }>;
  },

  async stats(): Promise<{
    total: number; active: number; reserved: number; sold: number; rented: number;
    inactive: number; for_sale: number; for_rent: number; exclusive: number;
    featured: number; outdated: number; without_photos: number;
  }> {
    const res = await api.get('/properties/stats');
    return (res.data as { data: Record<string, number> }).data as {
      total: number; active: number; reserved: number; sold: number; rented: number;
      inactive: number; for_sale: number; for_rent: number; exclusive: number;
      featured: number; outdated: number; without_photos: number;
    };
  },
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  sale:      'Venda',
  rent:      'Locação',
  sale_rent: 'Venda + Locação',
  season:    'Temporada',
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment:       'Apartamento',
  house:           'Casa',
  condo_house:     'Casa em Condomínio',
  lot:             'Lote/Terreno',
  commercial_room: 'Sala Comercial',
  warehouse:       'Galpão',
  farm:            'Fazenda',
  studio:          'Studio',
  kitnet:          'Kitnet',
  loft:            'Loft',
  penthouse:       'Cobertura',
  duplex:          'Duplex',
  triplex:         'Triplex',
  other:           'Outro',
};

export const STATUS_LABELS: Record<string, string> = {
  draft:    'Rascunho',
  active:   'Ativo',
  reserved: 'Reservado',
  sold:     'Vendido',
  rented:   'Alugado',
  inactive: 'Inativo',
};

export const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  reserved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sold:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rented:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
