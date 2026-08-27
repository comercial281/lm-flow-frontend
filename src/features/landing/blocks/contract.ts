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
  'rich_text',
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
  title: z.string().max(80).default('Ficha Técnica'),
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

/** Texto livre da equipe do cliente. Nasce SEM título e com corpo vazio: é uma
 *  seção que só existe porque alguém a adicionou de propósito, e um título
 *  padrão apareceria na página sem ninguém ter escrito nada. */
const richTextConfig = z.object({
  title: z.string().max(80).optional(),
  html: z.string().default(''),
  align: z.enum(['left', 'center']).default('left'),
});

const amenitiesConfig = z.object({
  title: z.string().max(80).default('Infraestrutura'),
  items: z.array(z.string().max(60)).default([]),
});

const galleryConfig = z.object({
  /** 'property' = fotos publicadas do imóvel (como sempre foi).
   *  'manual'   = as fotos enviadas aqui mesmo, em `images`. Landing de imóvel
   *  que não está cadastrado não tem foto nenhuma pra puxar. */
  source: sourceEnum,
  title: z.string().max(80).default('Galeria'),
  /** PropertyPhoto ids to show, in order. Empty = all published photos. */
  photoIds: z.array(z.string()).default([]),
  /** Fotos enviadas pelo editor. `url` é string solta (e não `.url()`) porque o
   *  upload pode devolver caminho relativo, e um endereço que não casa com a
   *  validação derrubaria a configuração inteira da seção. */
  images: z
    .array(z.object({ url: z.string(), caption: z.string().max(120).optional() }))
    .default([]),
});

const mapConfig = z.object({
  source: sourceEnum,
  lat: z.number().optional(),
  lng: z.number().optional(),
  title: z.string().max(80).default('O que tem próximo do imóvel?'),
  /** O endereço que o lead LÊ na página. Vazio = endereço do imóvel. */
  address: z.string().max(160).optional(),
  /** O que o mapa procura. É SEMPRE a região (bairro, cidade) — nunca a rua com
   *  número, mesmo que ela esteja escrita em `address`: o mapa da página de
   *  imóvel do site também mostra só a região, para não entregar o endereço
   *  exato do imóvel a quem só viu o anúncio. Vazio = bairro/cidade/estado do
   *  imóvel. */
  region: z.string().max(120).optional(),
  showMap: z.boolean().default(true),
  pois: z
    .array(z.object({ label: z.string().max(80), minutes: z.number().int().min(0) }))
    .default([]),
});

const videoConfig = z.object({
  url: z.string().url().optional(),
  title: z.string().max(80).optional(),
});

const financeSimulatorConfig = z.object({
  /** Valor sobre o qual a simulação é feita. Vazio = preço do imóvel vinculado.
   *  Landing de imóvel que não está cadastrado não tem preço pra puxar, e a
   *  simulação inteira saía zerada, calada. */
  basePrice: z.number().nonnegative().optional(),
  entradaPct: z.number().min(0).max(100).default(10),
  reforcoQty: z.number().int().min(0).default(11),
  reforcoPct: z.number().min(0).max(100).default(0),
  chavesPct: z.number().min(0).max(100).default(0),
  prazoMeses: z.number().int().min(1).max(600).default(120),
  /* Textos da seção. Os padrões são exatamente o que a página mostrava quando
     estavam escritos por dentro — landing publicada antes disto não muda. */
  title: z.string().max(80).default('Plano de Pagamento'),
  subtitle: z.string().max(120).default('Pagamento direto com a construtora'),
  entradaLabel: z.string().max(40).default('Entrada'),
  mensaisLabel: z.string().max(40).default('Mensais'),
  reforcosLabel: z.string().max(40).default('Reforços'),
  chavesLabel: z.string().max(40).default('Chaves'),
  prazoLabel: z.string().max(40).default('Prazo'),
  footnote: z
    .string()
    .max(240)
    .default('* Simulação ilustrativa. Condições sujeitas à aprovação da incorporadora.'),
});

const constructionProgressConfig = z.object({
  source: sourceEnum,
  title: z.string().max(80).default('Progresso de Obra'),
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

/* ------------------------------------------------------------------ */
/* Formulário de lead: perguntas, opções e desvio                      */
/* ------------------------------------------------------------------ */

/** Para onde o formulário vai depois que o lead escolhe esta resposta.
 *  Só desvio PARA FRENTE: pular pra uma pergunta anterior prenderia o lead num
 *  laço. O editor só oferece perguntas abaixo, e o formulário ignora salto pra
 *  pergunta desconhecida (cai no "próxima"). */
export const optionNextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('next') }),
  z.object({ kind: z.literal('question'), id: z.string() }),
  z.object({ kind: z.literal('contact') }),
  z.object({ kind: z.literal('finish'), screen: z.enum(['thankyou', 'disqualified']) }),
]);

export type OptionNext = z.infer<typeof optionNextSchema>;

/** Uma alternativa de resposta. Tem IDENTIDADE (`id`) porque o peso, a
 *  desqualificação e o destino do lead se penduram nela: enquanto isso era
 *  casado pelo TEXTO, reescrever a alternativa desligava a regra em silêncio. */
export const leadFormOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  weight: z.number().optional(),
  disqualifies: z.boolean().optional(),
  next: optionNextSchema.optional(),
});

export type LeadFormOption = z.infer<typeof leadFormOptionSchema>;

export const leadFormStepSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(leadFormOptionSchema).default([]),
});

export type LeadFormStep = z.infer<typeof leadFormStepSchema>;

/** Id estável derivado do texto: uma landing gravada no formato antigo tem de
 *  chegar SEMPRE aos mesmos ids, senão o destino gravado em settings (indexado
 *  por id) apontaria pro vazio a cada carregamento. */
export function derivedOptionId(stepIndex: number, optionIndex: number, text: string): string {
  const slug = text
    .normalize('NFD')
    // Intervalo escrito em escape de propósito: acento combinante literal no
    // fonte some em qualquer normalização de editor, sem ninguém perceber.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `q${stepIndex + 1}o${optionIndex + 1}${slug ? `-${slug}` : ''}`;
}

export function derivedStepId(stepIndex: number): string {
  return `q${stepIndex + 1}`;
}

/** Aceita os dois formatos gravados e devolve sempre o novo:
 *
 *    antigo: { question, options: ['Sim', 'Não'] } + answerWeights/
 *            disqualifyingAnswers casados pelo texto, no nível do config
 *    novo:   { id, question, options: [{ id, text, weight, disqualifies, next }] }
 *
 *  Landing publicada antes desta leva continua abrindo, pontuando e capturando
 *  igual — o editor regrava nos dois formatos ao salvar. */
function normalizeSteps(raw: unknown, cfg: Record<string, unknown>): LeadFormStep[] {
  if (!Array.isArray(raw)) return [];
  const weights = (cfg.answerWeights ?? {}) as Record<string, number>;
  const disq = Array.isArray(cfg.disqualifyingAnswers) ? (cfg.disqualifyingAnswers as string[]) : [];

  return raw.flatMap((step, si) => {
    if (typeof step !== 'object' || step === null) return [];
    const s = step as Record<string, unknown>;
    const question = typeof s.question === 'string' ? s.question : '';
    const rawOptions = Array.isArray(s.options) ? s.options : [];

    const options: LeadFormOption[] = rawOptions.flatMap((opt: unknown, oi: number): LeadFormOption[] => {
      if (typeof opt === 'string') {
        return [{
          id: derivedOptionId(si, oi, opt),
          text: opt,
          weight: typeof weights[opt] === 'number' ? weights[opt] : undefined,
          disqualifies: disq.includes(opt) ? true : undefined,
        }];
      }
      if (typeof opt !== 'object' || opt === null) return [];
      const o = opt as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text : '';
      const id = typeof o.id === 'string' && o.id ? o.id : derivedOptionId(si, oi, text);
      const next = optionNextSchema.safeParse(o.next);
      return [{
        id,
        text,
        weight: typeof o.weight === 'number' ? o.weight : (typeof weights[text] === 'number' ? weights[text] : undefined),
        disqualifies: typeof o.disqualifies === 'boolean' ? o.disqualifies : (disq.includes(text) ? true : undefined),
        next: next.success ? next.data : undefined,
      }];
    });

    return [{
      id: typeof s.id === 'string' && s.id ? s.id : derivedStepId(si),
      question,
      options,
    }];
  });
}

/** Perguntas de qualificação padrão (as do VGV Elite). Exportado pra o editor
 *  usar de fallback quando o bloco ainda não tem `steps` no config gravado. */
export const DEFAULT_LEAD_FORM_STEPS: LeadFormStep[] = normalizeSteps(
  [
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
  ],
  {},
);

const leadFormShape = z.object({
  title: z.string().max(160).default('Preencha o formulário para falar com o especialista'),
  /** Nome do corretor/especialista mostrado no header e na tela final. */
  specialistName: z.string().max(60).optional(),
  ctaLabel: z.string().max(40).default('Falar com Especialista'),
  /** Número do botão "Fura a fila" da tela final. Vazio = o botão não aparece:
   *  ele existia sem número nenhum atrás e não abria conversa alguma, sendo o
   *  botão mais chamativo que o lead vê depois de se cadastrar. */
  whatsappPhone: z.string().max(30).optional(),
  /** "X pessoas estão interessadas nesse imóvel" na tela de obrigado. */
  interestedCount: z.number().int().min(0).default(14),
  /* --- Textos das telas do formulário. Cada padrão é EXATAMENTE o texto que a
     página mostrava enquanto ele estava escrito por dentro do componente: quem
     não mexer em nada continua vendo a mesma landing. --- */
  subtitle: z.string().max(160).default('Deixe seus dados e o corretor entrará em contato.'),
  contactTitle: z.string().max(80).default('Tenho interesse'),
  namePlaceholder: z.string().max(60).default('Seu nome *'),
  emailPlaceholder: z.string().max(60).default('E-mail'),
  backLabel: z.string().max(40).default('← Voltar'),
  /** `{atual}` e `{total}` são trocados pelos números do passo. Só aparece
   *  quando o formulário não tem desvio — com desvio, "Passo 3 de 5" é mentira. */
  stepCounterLabel: z.string().max(60).default('Passo {atual} de {total}'),
  sendingLabel: z.string().max(40).default('Enviando…'),
  retryLabel: z.string().max(40).default('Tentar de novo'),
  sendErrorMessage: z
    .string()
    .max(240)
    .default('Não conseguimos enviar seus dados. Confira sua conexão e toque em enviar de novo.'),
  whatsappLabel: z.string().max(80).default('Fura a fila e fale direto no WhatsApp'),
  specialistRole: z.string().max(80).default('Corretor de Imóveis · Alto Padrão'),
  specialistStatus: z.string().max(80).default('Disponível agora · responde em até 5 minutos'),
  /** `{n}` vira o número de interessados. Vazio = a linha não aparece. */
  interestedLabel: z.string().max(120).default('{n} pessoas estão interessadas nesse imóvel.'),
  /** Perguntas de qualificação (default = as do VGV Elite). Já chegam
   *  normalizadas pelo preprocess abaixo — ver normalizeSteps. */
  steps: z.array(leadFormStepSchema).default(DEFAULT_LEAD_FORM_STEPS),
  /** Nota de corte: score abaixo disso = desqualificado. */
  cutoff: z.number().int().default(0),
  /* --- Mapas LEGADOS da qualificação, casados pelo TEXTO da alternativa. O
     peso e a desqualificação moram hoje DENTRO da opção (que tem id); estes
     dois continuam sendo gravados junto (dual-write) para que um servidor ou
     uma landing publicada antes desta leva sigam pontuando igual. Não são
     servidos ao público. --- */
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
  /** Os dois textos abaixo passaram a valer de fato: a tela de obrigado dentro
   *  da página ignorava o que estava gravado aqui e mostrava um texto escrito
   *  por dentro do componente, então o campo do editor não fazia nada.
   *  `{especialista}` é trocado pelo nome do corretor. */
  thankyouTitle: z.string().max(120).default('Recebemos suas informações!'),
  thankyouMessage: z.string().max(400).default('Em breve um especialista entrará em contato com você. Fique de olho no seu WhatsApp.'),
});

/** As perguntas são normalizadas ANTES da validação porque a conversão do
 *  formato antigo precisa enxergar os mapas paralelos que estão ao lado delas,
 *  no mesmo config. */
const leadFormConfig = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const cfg = raw as Record<string, unknown>;
  if (cfg.steps === undefined) return cfg;
  return { ...cfg, steps: normalizeSteps(cfg.steps, cfg) };
}, leadFormShape);

/** Reescreve os mapas legados a partir das opções — o editor chama isto ao
 *  salvar, para que os dois formatos nunca discordem. */
export function withLegacyQualificationMaps(config: BlockConfig<'lead_form'>): BlockConfig<'lead_form'> {
  const answerWeights: Record<string, number> = {};
  const disqualifyingAnswers: string[] = [];
  for (const step of config.steps) {
    for (const opt of step.options) {
      if (typeof opt.weight === 'number' && opt.weight !== 0) answerWeights[opt.text] = opt.weight;
      if (opt.disqualifies && !disqualifyingAnswers.includes(opt.text)) disqualifyingAnswers.push(opt.text);
    }
  }
  return { ...config, answerWeights, disqualifyingAnswers };
}

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
  rich_text: richTextConfig,
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

/** Espaçamento da seção, em pixels. Mora na SEÇÃO e não dentro da configuração
 *  de cada tipo: assim vale para todas as seções de uma vez, e toda seção nova
 *  já nasce com o recurso. Campo ausente = o espaçamento padrão da landing. */
export const blockLayoutSchema = z.object({
  top: z.number().min(0).max(200).optional(),
  bottom: z.number().min(0).max(200).optional(),
  sides: z.number().min(0).max(80).optional(),
});

export type BlockLayout = z.infer<typeof blockLayoutSchema>;

/** Espaçamento padrão das seções, em pixels — o que a página sempre usou
 *  (`px-5 py-7`). Serve de placeholder nos campos do editor e de valor de
 *  referência do render. */
export const DEFAULT_BLOCK_LAYOUT = { top: 28, bottom: 28, sides: 20 } as const;

/** One block as stored in pages.content_blocks. */
export interface BlockInstance<T extends BlockType = BlockType> {
  id: string;
  type: T;
  visible: boolean;
  config: BlockConfig<T>;
  layout?: BlockLayout;
  schemaVersion: number;
}

const blockInstanceSchema = z
  .object({
    id: z.string(),
    type: z.enum(BLOCK_TYPES),
    visible: z.boolean().default(true),
    config: z.record(z.string(), z.unknown()).default({}),
    layout: blockLayoutSchema.optional(),
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
