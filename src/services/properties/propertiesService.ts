import api from '@/services/core/api';
import type { PropertyTypology, TypologySummary } from '@/features/properties/typologies';

export type { PropertyTypology, TypologySummary };

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
  ai_enabled?: boolean;
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
  on_sign?: boolean;
  responsible_id?: string | null;
  captor_id?: string | null;
  owner_contact_id?: string | null;
  /** Tag do imóvel: aplicada ao lead que entra pela página deste imóvel. */
  label_id?: string | null;
  responsible?: { id: string; name: string } | null;
  captor?: { id: string; name: string } | null;
  /** Características do imóvel e comodidades do condomínio (slugs do catálogo). */
  features?: string[];
  condo_features?: string[];
  /** Tipologias (plantas) do empreendimento — vazio quando o imóvel tem uma só. */
  typologies?: PropertyTypology[];
  /** Faixas prontas (min/max de dorms, área e preço) calculadas pelo backend. */
  typology_summary?: TypologySummary | null;
  /** Book (PDF do cadastro via importação) salvo no imóvel, para reenviar no chat. */
  has_book?: boolean;
  book_url?: string | null;
  book_file_name?: string | null;
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
  ai_enabled?: boolean;
  on_sign?: boolean;
  responsible_id?: string | null;
  captor_id?: string | null;
  owner_contact_id?: string | null;
  label_id?: string | null;
  features?: string[];
  condo_features?: string[];
  /** Tipologias (plantas) do empreendimento. Linha em branco é descartada no save. */
  typologies?: PropertyTypology[];
}

export interface PropertyMapMarker {
  id: string;
  code: string;
  title: string;
  lat: number | null;
  lng: number | null;
  city?: string;
  neighborhood?: string;
  display_price?: string;
  transaction_type: string;
  property_type: string;
  icon_summary?: {
    bedrooms: number;
    bathrooms: number;
    parking: number;
    useful_area_m2: number;
  };
}

export interface PropertiesListParams {
  q?: string;
  status?: string;
  transaction_type?: string;
  property_type?: string;
  city?: string;
  /** Só imóveis que têm book salvo (?has_book=1). */
  has_book?: boolean;
  page?: number;
  per_page?: number;
}

export interface PropertiesResponse {
  data: Property[];
  meta: { total: number; page: number; per_page: number };
}

/** Proposta da IA (ai_extract) — só o que estava no material; ausente = null. */
export interface AiExtractResult {
  title?: string | null;
  transaction_type?: string | null;
  property_type?: string | null;
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
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_cep?: string | null;
  address_street?: string | null;
  features?: string[] | null;
  condo_features?: string[] | null;
  /** Plantas que a IA/o parser acharam no book (vazio quando é unidade única). */
  typologies?: PropertyTypology[] | null;
  description?: string | null;
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

  // Aba Books: sobe/troca o book (PDF) de um imóvel já existente. Devolve o imóvel atualizado.
  async uploadBook(id: string, file: File, onProgress?: (pct: number) => void): Promise<Property> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await api.post(`/properties/${id}/book`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return (res.data as { data: Property }).data;
  },

  // Aba Books: remove o book do imóvel.
  async removeBook(id: string): Promise<Property> {
    const res = await api.delete(`/properties/${id}/book`);
    return (res.data as { data: Property }).data;
  },

  async generateDescription(
    id: string,
    opts: { tone?: string; audience?: string; focus?: string; apply?: boolean } = {}
  ): Promise<{ headline: string; description: string; highlights: string[] }> {
    const res = await api.post(`/properties/${id}/generate_description`, opts);
    return (res.data as { data: { headline: string; description: string; highlights: string[] } }).data;
  },

  /** IA lê texto colado OU link de um anúncio e PROPÕE os campos do imóvel +
   *  descrição no tom humano. Não salva — o form é preenchido pro corretor revisar. */
  async aiExtract(data: { text?: string; url?: string }): Promise<AiExtractResult> {
    const res = await api.post('/properties/ai_extract', data);
    return (res.data as { data: AiExtractResult }).data;
  },

  /** Preenche os campos a partir de um TXT/texto — 100% LOCAL, sem IA/API (regex
   *  + palavras-chave). Não gera descrição. */
  async parseText(text: string): Promise<AiExtractResult> {
    const res = await api.post('/properties/parse_text', { text });
    return (res.data as { data: AiExtractResult }).data;
  },

  /** Gera SÓ a descrição (IA) a partir dos campos do formulário — sem precisar de
   *  imóvel salvo. Usado pelo botão opt-in "Gerar descrição". */
  async generateDescriptionPreview(
    property: Partial<PropertyFormData>,
    opts: { text?: string; tone?: string; audience?: string; focus?: string } = {}
  ): Promise<{ headline: string; description: string }> {
    const res = await api.post('/properties/generate_description_preview', { property, ...opts });
    return (res.data as { data: { headline: string; description: string } }).data;
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
    // Backend espera { property_ids: [...] }, não { ids: [...] }
    const res = await api.post('/properties/batch_generate_descriptions', { property_ids: ids });
    return (res.data as { data: Array<{ id: string; status: string; headline?: string; description?: string; error?: string }> }).data as Array<{
      id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
    }>;
  },

  async mapBounds(bounds?: {
    ne_lat?: number; ne_lng?: number; sw_lat?: number; sw_lng?: number;
    transaction_type?: string; property_type?: string; max?: number;
  }): Promise<PropertyMapMarker[]> {
    const res = await api.get('/properties/map', { params: bounds });
    return (res.data as { data: PropertyMapMarker[] }).data;
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
  // Tipos nativos do backend (enums 13-20) — antes não mapeados
  cobertura:       'Cobertura',
  sobrado:         'Sobrado',
  sala_comercial:  'Sala Comercial',
  galpao:          'Galpão',
  predio:          'Prédio',
  terreno:         'Terreno',
  chacara:         'Chácara',
  sitio:           'Sítio',
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
  reserved: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  sold:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rented:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
