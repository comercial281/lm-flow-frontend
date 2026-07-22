import api from '@/services/core/api';

// Portais imobiliários (feed XML + leads). Backend: /api/v1/portals (lm-flow).
export interface Portal {
  portal_key: string;
  name: string;
  feed_format: 'vrsync' | 'meta_catalog';
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
}

export interface PortalDetail extends Portal {
  property_ids: string[];
  featured_property_ids: string[];
}

export const PORTAL_LOGOS: Record<string, string> = {
  portal_zap: '🟣',
  portal_imovelweb: '🟠',
  portal_chaves_na_mao: '🔑',
  portal_casa_mineira: '🏠',
  portal_meta_catalog: '📘',
  portal_generic: '🌐',
};

export const portalsService = {
  async list(): Promise<Portal[]> {
    const res = await api.get('/portals');
    return (res.data as { data: Portal[] }).data ?? [];
  },

  async get(portalKey: string): Promise<PortalDetail> {
    const res = await api.get(`/portals/${portalKey}`);
    return (res.data as { data: PortalDetail }).data;
  },

  async updatePublications(
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

  async regenerateToken(portalKey: string): Promise<string | null> {
    const res = await api.post(`/portals/${portalKey}/regenerate_token`);
    return (res.data as { data: { feed_url: string | null } }).data?.feed_url ?? null;
  },
};
