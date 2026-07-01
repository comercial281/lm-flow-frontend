import type { BlockConfig, BlockType } from './contract';

/**
 * Data contract consumed by the block render components.
 *
 * Intentionally decoupled from the app's `Property`/`Site` service types so the
 * public SSR renderer (separate Next.js app) can import this package without
 * pulling the whole frontend service layer. The editor adapts the app's
 * Property -> LandingProperty; the renderer adapts API JSON -> LandingProperty.
 */

export interface LandingPhoto {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  alt?: string;
  isCover?: boolean;
}

export interface LandingProperty {
  code: string;
  title: string;
  description?: string;
  stage?: 'ready' | 'in_construction' | 'launch' | 'pre_launch';
  salePrice?: number | null;
  displayPrice?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  suites?: number | null;
  parkingSpaces?: number | null;
  usefulAreaM2?: number | null;
  totalAreaM2?: number | null;
  city?: string;
  neighborhood?: string;
  state?: string;
  fullAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  photos?: LandingPhoto[];
  responsibleName?: string;
}

/** Branding source for a landing's theme. */
export type BrandMode = 'client' | 'development' | 'both';

export const BRAND_MODE_LABELS: Record<BrandMode, string> = {
  client: 'Marca do cliente',
  development: 'Marca do empreendimento',
  both: 'Cliente + empreendimento',
};

/** Per-page theme tokens (resolved from site/brand_mode/empreendimento).
 *  Suporta tema claro E escuro — os blocos usam estes tokens, nada hardcoded. */
export interface LandingTheme {
  primary: string;
  accent: string;
  bgStart: string;
  bgEnd: string;
  blockBg: string;
  /** Fundo dos cards internos (sub-blocos). */
  cardBg: string;
  /** Cor de borda/divisória. */
  border: string;
  /** Texto secundário/suave. */
  muted: string;
  icon: string;
  text: string;
  fontFamily: string;
}

export const DEFAULT_LANDING_THEME: LandingTheme = {
  primary: '#7C3AED',
  accent: '#9333EA',
  bgStart: '#0F0520',
  bgEnd: '#1A0A2E',
  blockBg: '#1A0A2E',
  cardBg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.1)',
  muted: 'rgba(255,255,255,0.6)',
  icon: '#9333EA',
  text: '#F5F3FF',
  fontFamily: 'Inter, system-ui, sans-serif',
};

/** CSS custom properties applied on a wrapper so blocks can use var(--lp-*). */
export function themeToCssVars(theme: LandingTheme): Record<string, string> {
  return {
    '--lp-primary': theme.primary,
    '--lp-accent': theme.accent,
    '--lp-bg-start': theme.bgStart,
    '--lp-bg-end': theme.bgEnd,
    '--lp-block-bg': theme.blockBg,
    '--lp-card': theme.cardBg,
    '--lp-border': theme.border,
    '--lp-muted': theme.muted,
    '--lp-icon': theme.icon,
    '--lp-text': theme.text,
    '--lp-font': theme.fontFamily,
  };
}

/** Templates de aparência prontos (todos dark — os blocos assumem fundo escuro). */
export interface LandingTemplate {
  id: string;
  name: string;
  theme: LandingTheme;
}

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    // Igual ao VGV Elite: LIGHT (fundo claro, texto escuro) com verde nos CTAs.
    id: 'vgv-elite',
    name: 'VGV Elite',
    theme: {
      primary: '#16A34A',
      accent: '#16A34A',
      bgStart: '#FFFFFF',
      bgEnd: '#F3F4F6',
      blockBg: '#FFFFFF',
      cardBg: '#F7F7F8',
      border: '#E5E7EB',
      muted: '#6B7280',
      icon: '#16A34A',
      text: '#111827',
      fontFamily: 'Inter, sans-serif',
    },
  },
  {
    id: 'violeta',
    name: 'Violeta LM',
    theme: { ...DEFAULT_LANDING_THEME },
  },
  {
    // Claro premium com dourado.
    id: 'ouro',
    name: 'Ouro Premium',
    theme: {
      primary: '#B8860B',
      accent: '#B8860B',
      bgStart: '#FFFDF7',
      bgEnd: '#F5F1E6',
      blockBg: '#FFFFFF',
      cardBg: '#FAF6EC',
      border: '#E7DFC9',
      muted: '#8A7B57',
      icon: '#B8860B',
      text: '#1C160B',
      fontFamily: 'Space Grotesk, sans-serif',
    },
  },
  {
    id: 'oceano',
    name: 'Oceano (Dark)',
    theme: {
      primary: '#2563EB',
      accent: '#38BDF8',
      bgStart: '#060B16',
      bgEnd: '#0B1220',
      blockBg: '#111A2B',
      cardBg: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.1)',
      muted: 'rgba(255,255,255,0.6)',
      icon: '#38BDF8',
      text: '#EAF2FF',
      fontFamily: 'Inter, sans-serif',
    },
  },
];

export const STAGE_LABELS: Record<NonNullable<LandingProperty['stage']>, string> = {
  ready: 'PRONTO',
  in_construction: 'EM OBRA',
  launch: 'LANÇAMENTO',
  pre_launch: 'PRÉ LANÇAMENTO',
};

export interface BlockComponentProps<T extends BlockType = BlockType> {
  config: BlockConfig<T>;
  property?: LandingProperty | null;
  theme: LandingTheme;
}

/** pt-BR currency. Coerces string decimals (Rails serializes decimal as string). */
export function formatBRL(value?: number | string | null): string {
  if (value == null) return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}
