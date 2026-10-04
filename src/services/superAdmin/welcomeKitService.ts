import api from '@/services/core/api';

/**
 * Kit de boas-vindas no grupo do cliente: montado uma vez em Plataforma → Kit de
 * boas-vindas, mandado cliente a cliente em Clientes → Funções.
 *
 * Backend: /api/v1/super/welcome_kit (Onboarding::WelcomeKit / WelcomeKitDelivery).
 */
export interface KitVideo { url: string; name: string; size: number }
export interface KitImage { url: string; caption: string }
export interface WelcomeKit {
  /** Só fica `true` depois do primeiro Salvar: antes disso o envio é recusado. */
  configured: boolean;
  /** Texto em vigor (o padrão quando o gravado está em branco). */
  template: string;
  /** O que foi gravado; vazio = usa o padrão. */
  raw_template: string;
  instance: string;
  video: KitVideo | null;
  images: KitImage[];
}
export type KitPieceKind = 'text' | 'video' | 'image';
export interface KitPiece { kind: KitPieceKind; label: string; text?: string; url?: string; caption?: string; name?: string }
export interface KitItem { kind: KitPieceKind; label: string; status: 'queued' | 'sent' | 'failed'; detail?: string | null }
export interface KitGroup { jid: string; name: string; source: 'cadastro' | 'nome'; found?: boolean }
export interface KitDelivery {
  state: 'running' | 'done';
  started_at: string;
  finished_at?: string | null;
  by: string;
  group: KitGroup;
  items: KitItem[];
  sent?: number;
  total?: number;
}
export interface KitConfigPayload { kit: WelcomeKit; default_template: string; vars: string[] }
export interface KitTenantState { configured: boolean; last: KitDelivery | null; progress: KitDelivery | null }
export interface KitPreview {
  configured: boolean;
  target: KitGroup | null;
  reason: string | null;
  pieces: KitPiece[];
  last: KitDelivery | null;
}
export interface KitToSave { template: string; instance: string; video: KitVideo | null; images: KitImage[] }

const BASE = '/super/welcome_kit';

export const welcomeKitService = {
  async get(): Promise<KitConfigPayload> {
    const res = await api.get(BASE);
    return res.data.data;
  },
  async save(kit: KitToSave): Promise<KitConfigPayload> {
    const res = await api.put(BASE, { kit });
    return res.data.data;
  },
  async tenantState(tenantId: string): Promise<KitTenantState> {
    const res = await api.get(`${BASE}/tenants/${tenantId}`);
    return res.data.data;
  },
  async preview(tenantId: string): Promise<KitPreview> {
    const res = await api.get(`${BASE}/tenants/${tenantId}/preview`);
    return res.data.data;
  },
  async deliver(tenantId: string): Promise<KitDelivery> {
    const res = await api.post(`${BASE}/tenants/${tenantId}/deliveries`);
    return res.data.data.progress;
  },
};
