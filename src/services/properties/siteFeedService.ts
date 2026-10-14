// Integrações → Sistemas → Site da imobiliária (13/10/2026). Servidor: lm-flow, PropertyFeedSourceController.
import api from '@/services/core/api';

export type EstadoDaFonte = 'off' | 'waiting' | 'ok' | 'problem' | 'stopped';

export interface FonteDoSite {
  configured: boolean;
  state: EstadoDaFonte;
  id?: string;
  url?: string;
  format?: 'vrsync' | 'basel';
  enabled?: boolean;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_count?: number | null;
  /** Contagens (create/update/...) + 'at' + 'warnings' (lista de objetos). */
  last_summary?: Record<string, unknown>;
  last_error?: string | null;
  consecutive_failures?: number;
}

export interface AmostraDaPrevia {
  code: string;
  title: string;
  type_label: string;
  price_label: string | null;
  city: string | null;
  photos: number;
  action: 'create' | 'update' | 'unchanged';
}

export interface Previa {
  format: 'vrsync' | 'basel';
  provider: string | null;
  total: number;
  counts: Record<'create' | 'update' | 'unchanged' | 'inactivate' | 'reactivate' | 'skip', number>;
  warnings: { key: string; count: number; text: string }[];
  sample: AmostraDaPrevia[];
  shrunk: boolean;
}

const BASE = '/property_feed_source';
const dados = <T,>(res: { data: unknown }) => (res.data as { data: T }).data;

export const siteFeedService = {
  async get(): Promise<FonteDoSite> { return dados<FonteDoSite>(await api.get(BASE)); },
  /** Lê o arquivo e mostra o que vai acontecer. Nada é gravado. Erro = a frase do servidor. */
  async previa(url: string): Promise<Previa> { return dados<Previa>(await api.post(`${BASE}/preview`, { url })); },
  async confirmar(url: string, { mesmoAssim = false } = {}): Promise<FonteDoSite> {
    return dados<FonteDoSite>(await api.put(BASE, { url, accept_shrink: mesmoAssim }));
  },
  async atualizarAgora({ mesmoAssim = false } = {}): Promise<FonteDoSite> {
    return dados<FonteDoSite>(await api.post(`${BASE}/refresh`, { accept_shrink: mesmoAssim }));
  },
  async desligar(): Promise<FonteDoSite> { return dados<FonteDoSite>(await api.delete(BASE)); },
};

export default siteFeedService;
