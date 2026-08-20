import api from '@/services/core/api';
import {
  type BlockInstance,
  type BrandMode,
  type LandingTheme,
  defaultLandingBlocks,
  parsePageBlocks,
  safeParsePageBlocks,
} from '@/features/landing/blocks';

/** Shape returned by Api::V1::PagesController#serialize_page. */
export interface LandingPageDTO {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  template_type: string;
  page_kind: 'portal_static' | 'ad_landing';
  property_id?: string | null;
  brand_mode?: 'client' | 'development' | 'both' | null;
  indexable: boolean;
  active: boolean;
  public_host?: string | null;
  lead_pipeline_id?: string | null;
  lead_stage_id?: string | null;
  lead_label_id?: string | null;
  content_blocks: unknown[];
  theme?: Partial<LandingTheme> | null;
  /** Config extra da landing (Fatia 2b+): roteamento por qualificação, etc. */
  settings?: Record<string, unknown> | null;
  content_html?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingPage {
  dto: LandingPageDTO;
  blocks: BlockInstance[];
  theme: Partial<LandingTheme>;
}

function unwrap<T>(res: { data: unknown }): T {
  return (res.data as { data: T }).data;
}

function toLandingPage(dto: LandingPageDTO): LandingPage {
  return {
    dto,
    blocks: safeParsePageBlocks(dto.content_blocks),
    theme: dto.theme ?? {},
  };
}

export interface CreateLandingForPropertyInput {
  propertyId: string;
  title: string;
  slug?: string;
  brandMode?: 'client' | 'development' | 'both';
}

export const landingPageService = {
  async get(siteId: string, pageId: string): Promise<LandingPage> {
    const res = await api.get(`/sites/${siteId}/pages/${pageId}`);
    return toLandingPage(unwrap<LandingPageDTO>(res));
  },

  async listForSite(siteId: string): Promise<LandingPageDTO[]> {
    const res = await api.get(`/sites/${siteId}/pages`);
    return unwrap<LandingPageDTO[]>(res);
  },

  /** Create a blank ad landing NOT tied to any property (montar do zero). */
  async createBlank(siteId: string, title: string): Promise<LandingPage> {
    const res = await api.post(`/sites/${siteId}/pages`, {
      page: {
        title,
        template_type: 'custom',
        page_kind: 'ad_landing',
        brand_mode: 'client',
        indexable: false,
        in_menu: false,
        active: false, // rascunho até publicar
        content_blocks: defaultLandingBlocks(),
      },
    });
    return toLandingPage(unwrap<LandingPageDTO>(res));
  },

  /** Publish the landing with a chosen public name (slug). active=true. */
  async publish(siteId: string, pageId: string, slug: string): Promise<LandingPageDTO> {
    const res = await api.put(`/sites/${siteId}/pages/${pageId}`, {
      page: { slug, active: true },
    });
    return unwrap<LandingPageDTO>(res);
  },

  /** Move back to draft (unpublish). */
  async unpublish(siteId: string, pageId: string): Promise<LandingPageDTO> {
    const res = await api.put(`/sites/${siteId}/pages/${pageId}`, { page: { active: false } });
    return unwrap<LandingPageDTO>(res);
  },

  /** Salva o roteamento de lead da landing: pipeline/estagio/tag de destino
   *  (ramo padrão = qualificado) + settings opcional (ramo desqualificado). */
  async saveRouting(
    siteId: string,
    pageId: string,
    routing: { lead_pipeline_id: string | null; lead_stage_id: string | null; lead_label_id: string | null },
    settings?: Record<string, unknown>,
  ): Promise<LandingPageDTO> {
    const res = await api.put(`/sites/${siteId}/pages/${pageId}`, {
      page: settings ? { ...routing, settings } : routing,
    });
    return unwrap<LandingPageDTO>(res);
  },

  /** All ad landings of the site (property-linked or standalone). */
  async listLandings(siteId: string): Promise<LandingPageDTO[]> {
    const pages = await this.listForSite(siteId);
    return pages.filter((p) => p.page_kind === 'ad_landing');
  },

  /** Returns the property's ad landing, creating it (seeded) on first access. */
  async getOrCreateForProperty(
    siteId: string,
    input: CreateLandingForPropertyInput,
  ): Promise<LandingPage> {
    const pages = await this.listForSite(siteId);
    const existing = pages.find(
      (p) => p.page_kind === 'ad_landing' && p.property_id === input.propertyId,
    );
    if (existing) return toLandingPage(existing);
    return this.createForProperty(siteId, input);
  },

  /** Create an ad landing page for a property, seeded with the default blocks. */
  async createForProperty(
    siteId: string,
    input: CreateLandingForPropertyInput,
  ): Promise<LandingPage> {
    const res = await api.post(`/sites/${siteId}/pages`, {
      page: {
        title: input.title,
        slug: input.slug,
        template_type: 'property_detail',
        page_kind: 'ad_landing',
        property_id: input.propertyId,
        brand_mode: input.brandMode ?? 'development',
        indexable: false,
        in_menu: false,
        active: false, // nasce como rascunho até publicar
        content_blocks: defaultLandingBlocks(),
      },
    });
    return toLandingPage(unwrap<LandingPageDTO>(res));
  },

  /** Persist the block arrangement + theme + brand mode from the editor. */
  async saveBlocks(
    siteId: string,
    pageId: string,
    blocks: BlockInstance[],
    theme?: Partial<LandingTheme>,
    brandMode?: BrandMode,
  ): Promise<LandingPage> {
    const res = await api.put(`/sites/${siteId}/pages/${pageId}`, {
      page: {
        content_blocks: blocks,
        ...(theme ? { theme } : {}),
        ...(brandMode ? { brand_mode: brandMode } : {}),
      },
    });
    // Re-validate what the server stored so the editor reloads a clean state.
    const dto = unwrap<LandingPageDTO>(res);
    return { dto, blocks: parsePageBlocks(dto.content_blocks), theme: dto.theme ?? {} };
  },
};
