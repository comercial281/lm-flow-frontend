import api from '@/services/core/api';

export interface PropertyPhoto {
  id: string;
  property_id: string;
  file_url: string;
  thumbnail_url?: string | null;
  file_name?: string | null;
  photo_type: string;
  position: number;
  is_cover: boolean;
  published: boolean;
  caption?: string | null;
  alt_text?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  created_at: string;
}

export interface PropertyPhotoFormData {
  file_url: string;
  photo_type?: string;
  caption?: string;
  is_cover?: boolean;
  published?: boolean;
}

export const PHOTO_TYPE_LABELS: Record<string, string> = {
  main:              'Principal',
  exterior:          'Fachada/Exterior',
  interior_living:   'Sala',
  interior_bedroom:  'Quarto',
  interior_kitchen:  'Cozinha',
  interior_bathroom: 'Banheiro',
  balcony:           'Varanda',
  parking:           'Garagem',
  leisure:           'Lazer',
  view:              'Vista',
  floor_plan:        'Planta',
  video:             'Vídeo',
  other:             'Outro',
};

const base = (propertyId: string) => `/properties/${propertyId}/photos`;

export const propertyPhotosService = {
  async list(propertyId: string): Promise<PropertyPhoto[]> {
    const res = await api.get(base(propertyId));
    return (res.data as { data: PropertyPhoto[] }).data;
  },

  async create(propertyId: string, data: PropertyPhotoFormData): Promise<PropertyPhoto> {
    const res = await api.post(base(propertyId), { photo: data });
    return (res.data as { data: PropertyPhoto }).data;
  },

  async update(propertyId: string, photoId: string, data: Partial<PropertyPhotoFormData>): Promise<PropertyPhoto> {
    const res = await api.put(`${base(propertyId)}/${photoId}`, { photo: data });
    return (res.data as { data: PropertyPhoto }).data;
  },

  async delete(propertyId: string, photoId: string): Promise<void> {
    await api.delete(`${base(propertyId)}/${photoId}`);
  },

  async setAsCover(propertyId: string, photoId: string): Promise<PropertyPhoto> {
    const res = await api.put(`${base(propertyId)}/${photoId}/set_as_cover`);
    return (res.data as { data: PropertyPhoto }).data;
  },

  async reorder(propertyId: string, positions: { id: string; position: number }[]): Promise<PropertyPhoto[]> {
    const res = await api.post(`${base(propertyId)}/reorder`, { positions });
    return (res.data as { data: PropertyPhoto[] }).data;
  },
};
