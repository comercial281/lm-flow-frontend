import api from '@/services/core/api';

// Portais imobiliários (feed XML + leads). Backend: /api/v1/portals (lm-flow).

/**
 * Um tipo de anúncio do portal (Padrão, Destaque, Super Destaque…), na ordem
 * em que o servidor os serve. O tipo base (o padrão de quem entra na lista) é
 * o que vem com `base: true`; servidor que ainda não manda `base` tem o
 * PRIMEIRO como base. `limit` nulo é ilimitado; `count` é quantos imóveis
 * estão gravados naquele tipo hoje.
 */
export interface PortalAdType {
  key: string;
  label: string;
  feed_value: string;
  base?: boolean;
  limit: number | null;
  count: number;
}

/** Endereço que sai no anúncio: só o bairro, rua sem número, ou completo. */
export type PortalDisplayAddress = 'neighborhood' | 'street' | 'all';

/**
 * Configuração do portal (a tela *Configurar*). Tudo opcional/nulo: o
 * `PUT settings` é parcial, e o que não viaja fica como está.
 */
export interface PortalSettings {
  provider_name?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  display_address?: PortalDisplayAddress | null;
  leads_enabled?: boolean | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  roleta_config_id?: string | null;
  default_assignee_id?: string | null;
  /** Cota por tipo de anúncio, pela chave do tipo. 0 = ilimitado. */
  ad_plan?: Record<string, number> | null;
  /** Guardado como texto decimal com ponto ("3593.45"). */
  monthly_investment?: string | null;
}

export interface PortalPublication {
  property_id: string;
  ad_type: string;
}

export interface PortalFeedAccess {
  at: string;
  listings: number;
}

export interface Portal {
  portal_key: string;
  name: string;
  feed_format: 'vrsync' | 'opennavent' | 'meta_catalog';
  capabilities: Array<'feed' | 'webhook_leads' | 'email_leads' | 'highlight'>;
  onboarding: string[];
  connected: boolean;
  is_enabled: boolean;
  integration_id: string | null;
  sent_count: number;
  featured_count: number;
  last_accessed_at: string | null;
  active: boolean;
  feed_url: string | null;
  lead_webhook_url: string | null;
  /** `validated` = formato conferido no testador do portal; `adapted` = a confirmar. */
  integration_status?: 'validated' | 'adapted';
  status_note?: string | null;
  /** Ausente no servidor antigo: a tela cai no modo legado (estrela de destaque). */
  ad_types?: PortalAdType[];
  settings?: PortalSettings | null;
}

export interface PortalDetail extends Portal {
  property_ids: string[];
  featured_property_ids: string[];
  /** Novo formato; ausente no servidor antigo (usar `legadoParaPublicacoes`). */
  publications?: PortalPublication[];
  /** Últimas 30 leituras do feed pelo portal. */
  feed_access_log?: PortalFeedAccess[];
}

export const portalsService = {
  async list(): Promise<Portal[]> {
    const res = await api.get('/portals');
    return (res.data as { data: Portal[] }).data ?? [];
  },

  async get(portalKey: string): Promise<PortalDetail> {
    const res = await api.get(`/portals/${portalKey}`);
    return (res.data as { data: PortalDetail }).data;
  },

  /**
   * Grava quais imóveis vão pro portal e em que tipo de anúncio cada um.
   * Sem `confirmOverflow`, cota estourada volta 422 `AD_PLAN_EXCEEDED` com
   * `details.overflows`; com ele, grava e o portal rebaixa o que sobrar.
   */
  async updatePublications(
    portalKey: string,
    publications: PortalPublication[],
    opts: { confirmOverflow?: boolean } = {},
  ): Promise<PortalDetail> {
    const res = await api.put(`/portals/${portalKey}/publications`, {
      publications,
      confirm_overflow: opts.confirmOverflow === true,
    });
    return (res.data as { data: PortalDetail }).data;
  },

  /** Formato antigo (servidor sem `ad_types`): lista de ids + ids em destaque. */
  async updatePublicationsLegacy(
    portalKey: string,
    propertyIds: string[],
    featuredIds: string[],
  ): Promise<PortalDetail> {
    const res = await api.put(`/portals/${portalKey}/publications`, {
      property_ids: propertyIds,
      featured_ids: featuredIds,
    });
    return (res.data as { data: PortalDetail }).data;
  },

  /** `PUT /portals/:key/settings` — corpo parcial; responde o `show` inteiro. */
  async updateSettings(
    portalKey: string,
    partial: Partial<PortalSettings>,
  ): Promise<PortalDetail> {
    const res = await api.put(`/portals/${portalKey}/settings`, partial);
    return (res.data as { data: PortalDetail }).data;
  },

  async regenerateToken(portalKey: string): Promise<string | null> {
    const res = await api.post(`/portals/${portalKey}/regenerate_token`);
    return (res.data as { data: { feed_url: string | null } }).data?.feed_url ?? null;
  },
};
