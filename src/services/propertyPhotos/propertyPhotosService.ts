import api from '@/services/core/api';

export interface PropertyPhoto {
  id: string;
  property_id: string;
  file_url: string;
  thumbnail_url?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  content_type?: string | null;
  photo_type: string;
  position: number;
  is_cover: boolean;
  published: boolean;
  caption?: string | null;
  alt_text?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  attached?: boolean;
  created_at: string;
}

export interface PropertyPhotoFormData {
  file_url: string;
  photo_type?: string;
  caption?: string;
  is_cover?: boolean;
  published?: boolean;
}

export interface PropertyPhotoUploadOpts {
  photoType?: string;
  caption?: string;
  isCover?: boolean;
  published?: boolean;
  onProgress?: (percent: number) => void;
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
  audio:             'Áudio',
  other:             'Outro',
};

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm',
];

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

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

  // Story 11-1: upload nativo multipart. Aceita 1+ arquivos numa única request.
  async upload(
    propertyId: string,
    files: File[],
    opts: PropertyPhotoUploadOpts = {},
  ): Promise<PropertyPhoto[]> {
    if (!files.length) return [];

    const fd = new FormData();
    files.forEach(f => fd.append('files[]', f, f.name));
    if (opts.photoType)         fd.append('photo_type', opts.photoType);
    if (opts.caption)           fd.append('caption', opts.caption);
    if (opts.isCover != null)   fd.append('is_cover', String(opts.isCover));
    if (opts.published != null) fd.append('published', String(opts.published));

    const res = await api.post(`${base(propertyId)}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        if (opts.onProgress && e.total) {
          opts.onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return (res.data as { data: PropertyPhoto[] }).data;
  },
};
