// src/services/superAdmin/comunicadoService.ts
import api from '@/services/core/api';

/**
 * Comunicado de WhatsApp (Área do Admin → Comunicação → WhatsApp).
 *
 * Backend: /api/v1/super/comunicado (Comunicados::Targets e Comunicados::Delivery).
 * O envio roda no servidor; a tela pede, acompanha e mostra o resultado. O
 * endereço de cada destino nunca chega aqui.
 */
export type ComunicadoModo = 'owners' | 'groups';

export interface ComunicadoAlvo {
  tenant_id: string;
  name: string;
  /** Donos: os dígitos do telefone. Grupos: o nome do grupo. null = fica de fora. */
  destination: string | null;
  /** Por que ficou de fora ("Sem telefone", "Grupo não achado"). */
  reason: string | null;
}

export interface ComunicadoAlvos {
  mode: ComunicadoModo;
  /** O número que envia: o pedido, ou o padrão da plataforma. */
  instance: string;
  /** O envio em andamento, para retomar o acompanhamento. */
  running_id: string | null;
  /** Grupos: o número não devolveu grupo nenhum. É erro de leitura, não "nenhum grupo". */
  unreadable: boolean;
  targets: ComunicadoAlvo[];
}

export type ComunicadoItemStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface ComunicadoItem {
  tenant_id: string;
  name: string;
  destination: string | null;
  status: ComunicadoItemStatus;
  detail: string | null;
}

export interface ComunicadoAndamento {
  id: string;
  state: 'running' | 'done' | 'interrupted';
  mode: ComunicadoModo;
  instance: string;
  message: string;
  by: string;
  started_at: string;
  finished_at: string | null;
  /** Quantos têm destino: o N confirmado. */
  total: number;
  sent: number;
  failed: number;
  items: ComunicadoItem[];
}

export interface ComunicadoEnvio {
  mode: ComunicadoModo;
  instance: string;
  message: string;
  tenant_ids: string[];
  /** O N da confirmação. O servidor recusa se a conta dele der outra. */
  expected: number;
}

const BASE = '/super/comunicado';

export const comunicadoService = {
  async alvos(mode: ComunicadoModo, instance?: string): Promise<ComunicadoAlvos> {
    const res = await api.get(`${BASE}/targets`, { params: { mode, instance: instance || undefined } });
    return (res.data as { data: ComunicadoAlvos }).data;
  },

  async enviar(envio: ComunicadoEnvio): Promise<string> {
    const res = await api.post(BASE, envio);
    return (res.data as { data: { id: string } }).data.id;
  },

  async andamento(id: string): Promise<ComunicadoAndamento> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: ComunicadoAndamento }).data;
  },
};
