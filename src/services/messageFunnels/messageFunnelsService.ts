import api from '@/services/core/api';
import type {
  MessageFunnel,
  MessageFunnelItem,
  FunnelPayload,
  TemplateVariablesResponse,
} from '@/types/messageFunnels';

// Envelope do backend: { success: true, data: T, message?: string }
// Per memory feedback_response_envelope_pattern — sempre `response.data.data`.
function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

class MessageFunnelsService {
  private get baseUrl(): string {
    return '/message_funnels';
  }

  async list(params: { search?: string; activeOnly?: boolean } = {}): Promise<MessageFunnel[]> {
    const response = await api.get(this.baseUrl, {
      params: {
        ...(params.search ? { search: params.search } : {}),
        ...(params.activeOnly ? { active: true } : {}),
      },
    });
    return unwrap<MessageFunnel[]>(response);
  }

  async get(id: string): Promise<MessageFunnel> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return unwrap<MessageFunnel>(response);
  }

  async create(payload: FunnelPayload): Promise<MessageFunnel> {
    const response = await api.post(this.baseUrl, { message_funnel: payload });
    return unwrap<MessageFunnel>(response);
  }

  async update(id: string, payload: Partial<FunnelPayload>): Promise<MessageFunnel> {
    const response = await api.patch(`${this.baseUrl}/${id}`, { message_funnel: payload });
    return unwrap<MessageFunnel>(response);
  }

  async destroy(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Incrementa usage_count quando operador dispara no chat
  async touch(id: string): Promise<void> {
    await api.post(`${this.baseUrl}/${id}/touch`);
  }

  /**
   * Upload de mídia via direct upload do ActiveStorage.
   *
   * 1) POST /rails/active_storage/direct_uploads → recebe signed_id + url temporária
   * 2) PUT na url temporária com o blob
   * 3) Retorna signed_id pra cliente incluir no payload do item
   *
   * Alternativa simples (esta implementação): multipart POST direto no endpoint do controller.
   * Backend faz attach via ActiveStorage::Blob.find_signed pra signed_id OU recebe multipart.
   * Mantemos multipart aqui pra reduzir round-trips no MVP.
   */
  async uploadItemMedia(funnelId: string, itemId: string, file: File): Promise<MessageFunnelItem> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${this.baseUrl}/${funnelId}/items/${itemId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<MessageFunnelItem>(response);
  }
}

class TenantTemplateVariablesService {
  private get baseUrl(): string {
    return '/tenant_template_variables';
  }

  async list(): Promise<TemplateVariablesResponse> {
    const response = await api.get(this.baseUrl);
    return unwrap<TemplateVariablesResponse>(response);
  }

  async create(payload: {
    token: string;
    label: string;
    description?: string;
    value_source: string;
    active?: boolean;
  }) {
    const response = await api.post(this.baseUrl, { tenant_template_variable: payload });
    return unwrap(response);
  }

  async update(id: string, payload: Partial<{
    label: string;
    description: string;
    value_source: string;
    active: boolean;
  }>) {
    const response = await api.patch(`${this.baseUrl}/${id}`, { tenant_template_variable: payload });
    return unwrap(response);
  }

  async destroy(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const messageFunnelsService = new MessageFunnelsService();
export const tenantTemplateVariablesService = new TenantTemplateVariablesService();
