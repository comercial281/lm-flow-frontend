import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

// Uma página do Facebook conectada para receber Lead Ads. O cliente pode ter
// várias — antes era uma só e conectar a segunda sobrescrevia a primeira.
export interface MetaPage {
  id: string;
  page_id: string;
  page_name: string;
  is_active: boolean;
  /** true = a página tem token próprio; false = usa o token de sistema. */
  uses_own_token: boolean;
  /** Existe algum token utilizável (próprio ou de sistema)? */
  has_token: boolean;
  /** Página inscrita no app p/ leadgen — sem isso o Facebook não envia o lead. */
  webhook_subscribed: boolean;
  webhook_subscribed_at: string | null;
  connected_at: string | null;
  last_error: string | null;
  /**
   * Recebe lead de QUALQUER formulário desta página? Falso por padrão desde
   * 24/08/2026: formulário não cadastrado não gera lead. Ligar isto devolve o
   * comportamento antigo (a página inteira entra) para este cliente.
   */
  accept_unconfigured_forms?: boolean;
}

// Página que o token de sistema enxerga — é a lista de onde o operador escolhe,
// em vez de descobrir o page_id na mão.
export interface AvailableMetaPage {
  page_id: string;
  name: string;
  tasks: string[];
  /** A página deu acesso a Leads ao nosso app/usuário do sistema? */
  leads_ok: boolean;
  already_added: boolean;
}

export interface MetaPagePayload {
  page_id: string;
  page_name?: string;
  access_token?: string;
}

export interface MetaPageUpdatePayload {
  page_name?: string;
  access_token?: string;
  is_active?: boolean;
  /** Só com isto o token é apagado — campo em branco significa "não mexer". */
  clear_token?: boolean;
  /** Aceitar lead de formulário não cadastrado nesta página (padrão: não). */
  accept_unconfigured_forms?: boolean;
}

const BASE = '/meta_pages';

export const metaPagesService = {
  async getAll(): Promise<MetaPage[]> {
    return extractData(await api.get(BASE)) ?? [];
  },

  async available(): Promise<AvailableMetaPage[]> {
    return extractData(await api.get(`${BASE}/available`)) ?? [];
  },

  async create(payload: MetaPagePayload): Promise<MetaPage> {
    return extractData(await api.post(BASE, payload));
  },

  async update(id: string, payload: MetaPageUpdatePayload): Promise<MetaPage> {
    return extractData(await api.patch(`${BASE}/${id}`, payload));
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  // Reinscreve a página no app p/ leadgen (ativa o recebimento em tempo real).
  async subscribeWebhook(id: string): Promise<MetaPage> {
    return extractData(await api.post(`${BASE}/${id}/subscribe_webhook`));
  },
};
