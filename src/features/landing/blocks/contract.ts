import { z } from 'zod';

/**
 * Landing block contract — single source of truth for the section system.
 *
 * Consumed by:
 *  - the visual editor (live preview + config panel)
 *  - the public SSR renderer (separate Next.js app, imports this contract)
 *  - backend validation (via the exported JSON Schema)
 *
 * A page (portal property template OR ad landing) stores an ordered array of
 * BlockInstance in `pages.content_blocks` (JSONB). Blocks whose config has
 * `source: 'property'` auto-fill from the linked Property; a manual override
 * always wins over the property value.
 */

export const PAGE_BLOCKS_SCHEMA_VERSION = 1;

export const BLOCK_TYPES = [
  'hero',
  'price_band',
  'tech_sheet',
  'description',
  'amenities',
  'gallery',
  'map',
  'video',
  'finance_simulator',
  'construction_progress',
  'consultant',
  'broker_audio',
  'valuation_history',
  'trust_badges',
  'track_record',
  'apartment_types',
  'lead_form',
  'sticky_cta',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Where a field pulls its value from. */
const sourceEnum = z.enum(['property', 'manual']).default('property');

/* ------------------------------------------------------------------ */
/* Per-block config schemas                                            */
/* ------------------------------------------------------------------ */

const heroConfig = z.object({
  source: sourceEnum,
  badge: z.string().max(40).optional(),
  headline: z.string().max(120).optional(),
  subheadline: z.string().max(200).optional(),
  imageUrl: z.string().url().optional(),
  ctaLabel: z.string().max(40).optional(),
});

const priceBandConfig = z.object({
  source: sourceEnum,
  text: z.string().max(160).optional(),
});

const techSheetConfig = z.object({
  source: sourceEnum,
  fields: z
    .array(
      z.enum([
        'bedrooms',
        'bathrooms',
        'suites',
        'parking_spaces',
        'useful_area_m2',
        'total_area_m2',
        'delivery',
        'units',
        'stage',
      ]),
    )
    .default(['bedrooms', 'bathrooms', 'parking_spaces', 'useful_area_m2']),
});

const descriptionConfig = z.object({
  source: sourceEnum,
  title: z.string().max(80).default('Sobre o Empreendimento'),
  html: z.string().optional(),
});

const amenitiesConfig = z.object({
  title: z.string().max(80).default('Infraestrutura'),
  items: z.array(z.string().max(60)).default([]),
});

const galleryConfig = z.object({
  source: sourceEnum,
  /** PropertyPhoto ids to show, in order. Empty = all published photos. */
  photoIds: z.array(z.string()).default([]),
});

const mapConfig = z.object({
  source: sourceEnum,
  lat: z.number().optional(),
  lng: z.number().optional(),
  title: z.string().max(80).default('O que tem próximo do imóvel?'),
  pois: z
    .array(z.object({ label: z.string().max(80), minutes: z.number().int().min(0) }))
    .default([]),
});

const videoConfig = z.object({
  url: z.string().url().optional(),
  title: z.string().max(80).optional(),
});

const financeSimulatorConfig = z.object({
  /** Defaults to the Property sale_price when omitted. */
  basePrice: z.number().nonnegative().optional(),
  entradaPct: z.number().min(0).max(100).default(10),
  reforcoQty: z.number().int().min(0).default(11),
  reforcoPct: z.number().min(0).max(100).default(0),
  chavesPct: z.number().min(0).max(100).default(0),
  prazoMeses: z.number().int().min(1).max(600).default(120),
});

const constructionProgressConfig = z.object({
  source: sourceEnum,
  percent: z.number().min(0).max(100).default(0),
  milestones: z
    .array(z.object({ label: z.string().max(80), date: z.string().max(40).optional() }))
    .default([]),
});

const consultantConfig = z.object({
  source: sourceEnum,
  name: z.string().max(80).optional(),
  creci: z.string().max(40).optional(),
  photoUrl: z.string().url().optional(),
  phone: z.string().max(30).optional(),
});

const brokerAudioConfig = z.object({
  audioUrl: z.string().url().optional(),
  label: z.string().max(80).optional(),
});

const valuationHistoryConfig = z.object({
  title: z.string().max(80).default('Histórico de Valorização'),
  points: z
    .array(z.object({ label: z.string().max(40), value: z.number() }))
    .default([]),
});

const trustBadgesConfig = z.object({
  items: z
    .array(z.object({ imageUrl: z.string().url().optional(), label: z.string().max(60).optional() }))
    .default([]),
});

const trackRecordConfig = z.object({
  title: z.string().max(80).default('Obras Entregues'),
  items: z
    .array(
      z.object({
        title: z.string().max(80),
        year: z.string().max(8).optional(),
        imageUrl: z.string().url().optional(),
      }),
    )
    .default([]),
});

const apartmentTypesConfig = z.object({
  title: z.string().max(80).default('Tipos de Apartamentos'),
  items: z
    .array(
      z.object({
        name: z.string().max(80),
        areaM2: z.number().optional(),
        price: z.number().optional(),
        planUrl: z.string().url().optional(),
      }),
    )
    .default([]),
});

/** Perguntas de qualificação padrão (as do VGV Elite). Exportado pra o editor
 *  usar de fallback quando o bloco ainda não tem `steps` no config gravado. */
export const DEFAULT_LEAD_FORM_STEPS: { question: string; options: string[] }[] = [
  {
    question: 'Quando você pretende comprar?',
    options: [
      'Quero fechar o quanto antes',
      'Nos próximos 30 dias',
      'Em até 3 meses',
      'Em 6 meses ou mais',
      'Ainda estou pesquisando',
    ],
  },
  {
    question: 'Como pretende pagar?',
    options: [
      'Já tenho financiamento aprovado',
      'Vou pagar à vista',
      'Estou em processo de aprovação',
      'Ainda não sei',
    ],
  },
];

const leadFormConfig = z.object({
  title: z.string().max(160).default('Preencha o formulário para falar com o especialista'),
  /** Nome do corretor/especialista mostrado no header e na tela final. */
  specialistName: z.string().max(60).optional(),
  ctaLabel: z.string().max(40).default('Falar com Especialista'),
  /** "X pessoas estão interessadas nesse imóvel" na tela de obrigado. */
  interestedCount: z.number().int().min(0).default(14),
  /** Perguntas de qualificação (default = as do VGV Elite). */
  steps: z
    .array(z.object({ question: z.string(), options: z.array(z.string()) }))
    .default(DEFAULT_LEAD_FORM_STEPS),
  /* --- Qualificação (Fatia 2a). Design não-quebra: opções seguem strings; a
     qualificação vem por mapas paralelos, casados pelo texto da resposta. --- */
  /** Nota de corte: score abaixo disso = desqualificado. */
  cutoff: z.number().int().default(0),
  /** Respostas que, escolhidas, desqualificam o lead na hora. */
  disqualifyingAnswers: z.array(z.string()).default([]),
  /** Peso (pontos) por resposta, somado no score. Chave = texto da opção. */
  answerWeights: z.record(z.string(), z.number()).default({}),
  /* --- Tela de resultado do lead desqualificado (Fatia 4a, variante in-page).
     Se o lead cai como desqualificado, mostra estes textos em vez da tela de
     "fura a fila". --- */
  disqualifiedTitle: z.string().max(120).default('Obrigado pelo seu interesse!'),
  disqualifiedMessage: z
    .string()
    .max(400)
    .default('Recebemos seus dados. No momento este imóvel pode não ser o ideal pro seu perfil, mas vamos te avisar sobre outras oportunidades que combinam com você.'),
  /* --- Páginas de resultado (Fatia 4b). 'inline' = tela na mesma página (4a);
     'url' = redireciona pra /lp/<slug>/obrigado|desqualificado (PageView
     próprio pro Pixel). --- */
  resultMode: z.enum(['inline', 'url']).default('inline'),
  thankyouTitle: z.string().max(120).default('Recebemos suas informações!'),
  thankyouMessage: z.string().max(400).default('Em breve um especialista entrará em contato com você. Fique de olho no seu WhatsApp.'),
});

const stickyCtaConfig = z.object({
  label: z.string().max(40).default('Falar com Especialista'),
  action: z.enum(['open_form', 'whatsapp']).default('open_form'),
  whatsappPhone: z.string().max(30).optional(),
});

/** Map block type -> config schema. Keep in sync with BLOCK_TYPES. */
export const BLOCK_CONFIG_SCHEMAS = {
  hero: heroConfig,
  price_band: priceBandConfig,
  tech_sheet: techSheetConfig,
  description: descriptionConfig,
  amenities: amenitiesConfig,
  gallery: galleryConfig,
  map: mapConfig,
  video: videoConfig,
  finance_simulator: financeSimulatorConfig,
  construction_progress: constructionProgressConfig,
  consultant: consultantConfig,
  broker_audio: brokerAudioConfig,
  valuation_history: valuationHistoryConfig,
  trust_badges: trustBadgesConfig,
  track_record: trackRecordConfig,
  apartment_types: apartmentTypesConfig,
  lead_form: leadFormConfig,
  sticky_cta: stickyCtaConfig,
} satisfies Record<BlockType, z.ZodTypeAny>;

export type BlockConfig<T extends BlockType = BlockType> = z.infer<
  (typeof BLOCK_CONFIG_SCHEMAS)[T]
>;

/* ------------------------------------------------------------------ */
/* Block instance + page                                              */
/* ------------------------------------------------------------------ */

/** One block as stored in pages.content_blocks. */
export interface BlockInstance<T extends BlockType = BlockType> {
  id: string;
  type: T;
  visible: boolean;
  config: BlockConfig<T>;
  schemaVersion: number;
}

const blockInstanceSchema = z
  .object({
    id: z.string(),
    type: z.enum(BLOCK_TYPES),
    visible: z.boolean().default(true),
    config: z.record(z.string(), z.unknown()).default({}),
    schemaVersion: z.number().int().default(PAGE_BLOCKS_SCHEMA_VERSION),
  })
  .transform((block) => {
    // Validate/normalize config against the type-specific schema. NUNCA lançar:
    // um bloco com config parcial/inválida não pode derrubar a página inteira
    // (NFR6). Se falhar, mantém o config cru (os componentes lidam com faltas).
    const schema = BLOCK_CONFIG_SCHEMAS[block.type];
    const parsed = schema.safeParse(block.config);
    return {
      ...block,
      config: parsed.success ? parsed.data : block.config,
    } as BlockInstance;
  });

export const pageBlocksSchema = z.array(blockInstanceSchema);

/** Parse + normalize an array of blocks coming from the API/editor. */
export function parsePageBlocks(raw: unknown): BlockInstance[] {
  return pageBlocksSchema.parse(raw ?? []);
}

/** Safe variant: never throws, returns the valid blocks it could parse. */
export function safeParsePageBlocks(raw: unknown): BlockInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockInstance[] = [];
  for (const item of raw) {
    const parsed = blockInstanceSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
