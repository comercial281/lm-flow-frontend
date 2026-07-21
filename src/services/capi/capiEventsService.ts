import api from '@/services/core/api';

// Estado de um evento manual (botão dentro do card / sidebar da conversa).
export interface CapiManualEvent {
  event_name: string;
  intent: string | null;
  sent_at: string | null;
  sent_by: string | null;
}

export interface CapiManualStatus {
  can_send: boolean;      // tem algum destino pronto pra receber a conversão
  is_enabled: boolean;    // pixel do próprio cliente ligado
  client_ready: boolean;  // pixel do cliente com id + token válidos
  events: CapiManualEvent[];
}

export interface CapiTarget {
  contactId?: string | number | null;
  pipelineItemId?: string | number | null;
}

const BASE = '/capi_events';

function toParams(target: CapiTarget) {
  const params: Record<string, string> = {};
  if (target.contactId) params.contact_id = String(target.contactId);
  if (target.pipelineItemId) params.pipeline_item_id = String(target.pipelineItemId);
  return params;
}

export const capiEventsService = {
  async status(target: CapiTarget): Promise<CapiManualStatus> {
    const res = await api.get(BASE, { params: toParams(target) });
    return (res.data as { data: CapiManualStatus }).data;
  },

  // Dispara a conversão na hora e devolve o estado já atualizado.
  async send(target: CapiTarget, eventName: string): Promise<CapiManualStatus> {
    const res = await api.post(BASE, { ...toParams(target), event_name: eventName });
    return (res.data as { data: CapiManualStatus }).data;
  },
};

export const CAPI_MANUAL_LABELS: Record<string, string> = {
  Qualificado: 'Qualificado',
  Desqualificado: 'Desqualificado',
  Purchase: 'Venda realizada',
};

// O que cada botão faz com o dinheiro do anúncio — em português de gente.
export const CAPI_MANUAL_HINTS: Record<string, string> = {
  Qualificado: 'Envia Lead à Meta: o algoritmo passa a buscar gente parecida com esta.',
  Desqualificado: 'Manda como exclusão: o Meta para de gastar com gente parecida com esta.',
  Purchase: 'Envia Purchase com o valor do card: otimiza o anúncio por venda.',
};
