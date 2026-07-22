import api from '@/services/core/api';

// Upload de imóveis em LOTE com IA: o corretor sobe vários books (PDF/imagem/
// docx/txt, 1 arquivo = 1 imóvel) e/ou URLs de anúncios; o backend processa em
// background e cria cada imóvel como rascunho. O progresso é acompanhado por
// polling no get() — o próprio GET "ressuscita" o lote se o job caiu.

export type ImportBatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'canceled';

export type ImportItemStatus = 'pending' | 'processing' | 'created' | 'error';

export interface ImportItemProperty {
  id: string;
  code: string;
  title: string;
  status: string;
  display_price?: string | null;
  has_price?: boolean;
  photos_count?: number;
  cover_photo_url?: string | null;
}

export interface PropertyImportItem {
  id: string;
  position: number;
  source_type: 'file' | 'url';
  source_url?: string | null;
  file_name?: string | null;
  status: ImportItemStatus;
  attempts: number;
  missing_fields: string[];
  error_message?: string | null;
  extracted_summary: {
    title?: string | null;
    transaction_type?: string | null;
    property_type?: string | null;
    sale_price?: number | null;
    rent_price?: number | null;
    address_city?: string | null;
    address_neighborhood?: string | null;
  };
  property?: ImportItemProperty | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface PropertyImportBatch {
  id: string;
  status: ImportBatchStatus;
  total_items: number;
  processed_items: number;
  success_items: number;
  error_items: number;
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: PropertyImportItem[];
}

export const IMPORT_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const IMPORT_MAX_FILES = 100;
export const IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (limite de PDF da IA)

export const MISSING_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  transaction_type: 'Negócio',
  property_type: 'Tipo',
  sale_price: 'Valor de venda',
  rent_price: 'Valor de aluguel',
  bedrooms: 'Quartos',
  bathrooms: 'Banheiros',
  useful_area_m2: 'Área útil',
  address_city: 'Cidade',
  address_neighborhood: 'Bairro',
};

export const propertyImportsService = {
  async createBatch(
    files: File[],
    opts: { urls?: string[]; onProgress?: (percent: number) => void } = {},
  ): Promise<PropertyImportBatch> {
    const fd = new FormData();
    files.forEach(f => fd.append('files[]', f, f.name));
    (opts.urls ?? []).forEach(u => fd.append('urls[]', u));

    const res = await api.post('/property_import_batches', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        if (opts.onProgress && e.total) {
          opts.onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return (res.data as { data: PropertyImportBatch }).data;
  },

  async get(id: string): Promise<PropertyImportBatch> {
    const res = await api.get(`/property_import_batches/${id}`);
    return (res.data as { data: PropertyImportBatch }).data;
  },

  async list(): Promise<PropertyImportBatch[]> {
    const res = await api.get('/property_import_batches');
    return (res.data as { data: PropertyImportBatch[] }).data;
  },

  async retryFailed(id: string): Promise<PropertyImportBatch> {
    const res = await api.post(`/property_import_batches/${id}/retry_failed`);
    return (res.data as { data: PropertyImportBatch }).data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/property_import_batches/${id}`);
  },
};
