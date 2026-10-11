import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import { LabelsResponse, LabelResponse, LabelDeleteResponse, Label } from '@/types/settings';

class LabelsService {
  async getLabels(opts: { withCounts?: boolean } = {}): Promise<LabelsResponse> {
    // per_page alto pra trazer o catálogo COMPLETO: /labels pagina em 20 por padrão,
    // e um catálogo truncado quebra a busca/seleção e a detecção de duplicata (criar
    // uma etiqueta que já existe fora da 1ª página dava "Validation failed").
    // 5000 e não 1000: a Mais Que Imóveis passa de 900 só de etiqueta de imóvel (10/10/2026).
    const params: Record<string, unknown> = { per_page: 5000 };
    if (opts.withCounts) params.with_counts = 1;
    const response = await api.get('/labels', { params });
    return extractResponse<Label>(response) as LabelsResponse;
  }

  async shuffleColor(labelId: string): Promise<Label> {
    const response = await api.post(`/labels/${labelId}/shuffle_color`);
    return extractData<Label>(response);
  }

  async createLabel(data: {
    title: string;
    description?: string;
    color: string;
    show_on_sidebar?: boolean;
  }): Promise<LabelResponse> {
    const response = await api.post('/labels', { label: data });
    return extractData<LabelResponse>(response);
  }

  async updateLabel(
    labelId: string,
    data: {
      title?: string;
      description?: string;
      color?: string;
      show_on_sidebar?: boolean;
    },
  ): Promise<Label> {
    const response = await api.patch(`/labels/${labelId}`, { label: data });
    return extractData<Label>(response);
  }

  async deleteLabel(labelId: string): Promise<LabelDeleteResponse> {
    const response = await api.delete(`/labels/${labelId}`);
    return extractData<LabelDeleteResponse>(response);
  }
}

export const labelsService = new LabelsService();
