import api from '@/services/core/api';

export interface SiteBranding {
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
}

export interface SiteContact {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface SiteSeo {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  og_image?: string | null;
}

export interface SiteTracking {
  gtm_id?: string | null;
  ga4_measurement_id?: string | null;
  facebook_pixel_id?: string | null;
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  primary_domain?: string | null;
  secondary_domains?: string[];
  active: boolean;
  published: boolean;
  branding: SiteBranding;
  contact: SiteContact;
  social_links?: Record<string, string>;
  seo: SiteSeo;
  tracking: SiteTracking;
  pages_count?: number;
  articles_count?: number;
  leads_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SitePage {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  content?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  active: boolean;
  in_menu: boolean;
  menu_position?: number;
  template?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteArticle {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  content?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteFormData {
  name: string;
  slug?: string;
  primary_domain?: string;
  active?: boolean;
  published?: boolean;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  accent_color?: string;
  font_family?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  contact_address?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  gtm_id?: string;
  ga4_measurement_id?: string;
  facebook_pixel_id?: string;
}

export interface PageFormData {
  title: string;
  slug?: string;
  content?: string;
  meta_title?: string;
  meta_description?: string;
  active?: boolean;
  in_menu?: boolean;
  menu_position?: number;
  template?: string;
}

export interface ArticleFormData {
  title: string;
  content?: string;
  excerpt?: string;
  cover_image_url?: string;
  meta_title?: string;
  meta_description?: string;
}

export const siteBuilderService = {
  // Sites
  async listSites(): Promise<Site[]> {
    const res = await api.get('/sites');
    return (res.data as { data: Site[] }).data;
  },

  async getSite(id: string): Promise<Site> {
    const res = await api.get(`/sites/${id}`);
    return (res.data as { data: Site }).data;
  },

  async createSite(data: SiteFormData): Promise<Site> {
    const res = await api.post('/sites', { site: data });
    return (res.data as { data: Site }).data;
  },

  async updateSite(id: string, data: Partial<SiteFormData>): Promise<Site> {
    const res = await api.put(`/sites/${id}`, { site: data });
    return (res.data as { data: Site }).data;
  },

  async deleteSite(id: string): Promise<void> {
    await api.delete(`/sites/${id}`);
  },

  // Pages
  async listPages(siteId: string): Promise<SitePage[]> {
    const res = await api.get(`/sites/${siteId}/pages`);
    return (res.data as { data: SitePage[] }).data;
  },

  async createPage(siteId: string, data: PageFormData): Promise<SitePage> {
    const res = await api.post(`/sites/${siteId}/pages`, { page: data });
    return (res.data as { data: SitePage }).data;
  },

  async updatePage(siteId: string, pageId: string, data: Partial<PageFormData>): Promise<SitePage> {
    const res = await api.put(`/sites/${siteId}/pages/${pageId}`, { page: data });
    return (res.data as { data: SitePage }).data;
  },

  async deletePage(siteId: string, pageId: string): Promise<void> {
    await api.delete(`/sites/${siteId}/pages/${pageId}`);
  },

  // Articles
  async listArticles(siteId: string): Promise<SiteArticle[]> {
    const res = await api.get(`/sites/${siteId}/articles`);
    return (res.data as { data: SiteArticle[] }).data;
  },

  async createArticle(siteId: string, data: ArticleFormData): Promise<SiteArticle> {
    const res = await api.post(`/sites/${siteId}/articles`, { article: data });
    return (res.data as { data: SiteArticle }).data;
  },

  async updateArticle(siteId: string, articleId: string, data: Partial<ArticleFormData>): Promise<SiteArticle> {
    const res = await api.put(`/sites/${siteId}/articles/${articleId}`, { article: data });
    return (res.data as { data: SiteArticle }).data;
  },

  async publishArticle(siteId: string, articleId: string): Promise<SiteArticle> {
    const res = await api.post(`/sites/${siteId}/articles/${articleId}/publish`);
    return (res.data as { data: SiteArticle }).data;
  },

  async archiveArticle(siteId: string, articleId: string): Promise<SiteArticle> {
    const res = await api.post(`/sites/${siteId}/articles/${articleId}/archive`);
    return (res.data as { data: SiteArticle }).data;
  },

  async deleteArticle(siteId: string, articleId: string): Promise<void> {
    await api.delete(`/sites/${siteId}/articles/${articleId}`);
  },
};

export const ARTICLE_STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  published: 'Publicado',
  archived:  'Arquivado',
};

export const ARTICLE_STATUS_COLORS: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};
