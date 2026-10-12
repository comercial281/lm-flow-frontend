// Banner da Dashboard (spec LM FLOW/specs/2026-10-12-banner-dashboard-design.md).

export type AcaoDoBanner = 'details' | 'link' | 'none';
export type CargoDoBanner = 'admin' | 'manager' | 'agent';
export type SituacaoDoBanner = 'draft' | 'scheduled' | 'live' | 'ended';
export type ArteDoBanner = 'desktop' | 'mobile' | 'details';

/** O banner inteiro, como o admin vê. */
export interface BannerAdmin {
  id: string;
  name: string;
  status: 'draft' | 'published';
  situation: SituacaoDoBanner;
  click_action: AcaoDoBanner;
  details_title: string | null;
  details_body: string | null;
  details_button_path: string | null;
  link_url: string | null;
  roles: CargoDoBanner[];
  tenant_slugs: string[];
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  created_at: string | null;
  desktop_url: string | null;
  mobile_url: string | null;
  details_image_url: string | null;
  seen_count: number;
  clicked_count: number;
}

export interface ImobiliariaDoBanner { slug: string; name: string }

export interface PublicoDoBanner { people: number; tenants: number; unreadable: string[] }

/** O que a Dashboard recebe: só o que ela desenha. */
export interface BannerDaDashboard {
  id: string;
  desktop_url: string;
  mobile_url: string;
  click_action: AcaoDoBanner;
  details: { title: string; body: string; image_url: string | null; button_path: string | null } | null;
  link_url: string | null;
  clicked: boolean;
}

/** Campos que o editor grava. */
export interface CamposDoBanner {
  name?: string;
  click_action?: AcaoDoBanner;
  details_title?: string;
  details_body?: string;
  details_button_path?: string;
  link_url?: string;
  roles?: CargoDoBanner[];
  tenant_slugs?: string[];
  starts_at?: string | null;
  ends_at?: string | null;
}
