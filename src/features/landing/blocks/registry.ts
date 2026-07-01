import { v4 as uuidv4 } from 'uuid';
import {
  BLOCK_CONFIG_SCHEMAS,
  BLOCK_TYPES,
  PAGE_BLOCKS_SCHEMA_VERSION,
  type BlockInstance,
  type BlockType,
} from './contract';

/**
 * UI metadata for each block — drives the editor's section library and
 * config panel. The runtime contract lives in ./contract.ts; this file is
 * presentation only (labels in pt-BR, icons, grouping).
 */

export type BlockCategory = 'destaque' | 'imovel' | 'midia' | 'prova' | 'conversao';

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  /** lucide-react icon name. */
  icon: string;
  category: BlockCategory;
  /** Pulls data from the linked Property by default. */
  autoFill: boolean;
}

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  hero: {
    type: 'hero',
    label: 'Hero / Capa',
    description: 'Imagem de capa, nome do empreendimento e selo.',
    icon: 'Image',
    category: 'destaque',
    autoFill: true,
  },
  price_band: {
    type: 'price_band',
    label: 'Faixa de Preço',
    description: 'Condição de pagamento em destaque.',
    icon: 'Tag',
    category: 'destaque',
    autoFill: true,
  },
  tech_sheet: {
    type: 'tech_sheet',
    label: 'Ficha Técnica',
    description: 'Dormitórios, área, entrega e unidades.',
    icon: 'ListChecks',
    category: 'imovel',
    autoFill: true,
  },
  description: {
    type: 'description',
    label: 'Descrição',
    description: 'Texto sobre o empreendimento.',
    icon: 'AlignLeft',
    category: 'imovel',
    autoFill: true,
  },
  amenities: {
    type: 'amenities',
    label: 'Infraestrutura',
    description: 'Lista de itens de lazer e comodidades.',
    icon: 'Building2',
    category: 'imovel',
    autoFill: false,
  },
  gallery: {
    type: 'gallery',
    label: 'Galeria de Fotos',
    description: 'Fotos do imóvel.',
    icon: 'Images',
    category: 'midia',
    autoFill: true,
  },
  map: {
    type: 'map',
    label: 'Mapa / Localização',
    description: 'Mapa e pontos de interesse próximos.',
    icon: 'MapPin',
    category: 'imovel',
    autoFill: true,
  },
  video: {
    type: 'video',
    label: 'Vídeo',
    description: 'Vídeo do YouTube ou Vimeo.',
    icon: 'Video',
    category: 'midia',
    autoFill: false,
  },
  finance_simulator: {
    type: 'finance_simulator',
    label: 'Simulador de Financiamento',
    description: 'Sliders de entrada, reforços e prazo com cálculo ao vivo.',
    icon: 'Calculator',
    category: 'conversao',
    autoFill: true,
  },
  construction_progress: {
    type: 'construction_progress',
    label: 'Progresso de Obra',
    description: 'Percentual e marcos da obra.',
    icon: 'HardHat',
    category: 'imovel',
    autoFill: true,
  },
  consultant: {
    type: 'consultant',
    label: 'Consultor',
    description: 'Corretor responsável e contato.',
    icon: 'UserRound',
    category: 'conversao',
    autoFill: true,
  },
  broker_audio: {
    type: 'broker_audio',
    label: 'Áudio do Corretor',
    description: 'Mensagem de áudio do corretor.',
    icon: 'Mic',
    category: 'conversao',
    autoFill: false,
  },
  valuation_history: {
    type: 'valuation_history',
    label: 'Histórico de Valorização',
    description: 'Evolução de valor ao longo do tempo.',
    icon: 'TrendingUp',
    category: 'prova',
    autoFill: false,
  },
  trust_badges: {
    type: 'trust_badges',
    label: 'Selos de Confiança',
    description: 'Selos e provas de credibilidade.',
    icon: 'BadgeCheck',
    category: 'prova',
    autoFill: false,
  },
  track_record: {
    type: 'track_record',
    label: 'Obras Entregues',
    description: 'Histórico de entregas da construtora.',
    icon: 'Building',
    category: 'prova',
    autoFill: false,
  },
  apartment_types: {
    type: 'apartment_types',
    label: 'Tipos de Apartamentos',
    description: 'Plantas, metragens e preços.',
    icon: 'LayoutGrid',
    category: 'imovel',
    autoFill: false,
  },
  lead_form: {
    type: 'lead_form',
    label: 'Formulário de Lead',
    description: 'Quiz multi-step que qualifica e pontua o lead.',
    icon: 'ClipboardList',
    category: 'conversao',
    autoFill: false,
  },
  sticky_cta: {
    type: 'sticky_cta',
    label: 'CTA Fixo',
    description: 'Botão fixo de chamada para ação.',
    icon: 'MousePointerClick',
    category: 'conversao',
    autoFill: false,
  },
};

/** Library order shown in the editor. */
export const BLOCK_LIBRARY: BlockMeta[] = BLOCK_TYPES.map((t) => BLOCK_REGISTRY[t]);

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  destaque: 'Destaque',
  imovel: 'Imóvel',
  midia: 'Mídia',
  prova: 'Prova social',
  conversao: 'Conversão',
};

/** Build a fresh block with schema defaults applied. */
export function createBlock<T extends BlockType>(type: T): BlockInstance<T> {
  const config = BLOCK_CONFIG_SCHEMAS[type].parse({}) as BlockInstance<T>['config'];
  return {
    id: uuidv4(),
    type,
    visible: true,
    config,
    schemaVersion: PAGE_BLOCKS_SCHEMA_VERSION,
  };
}

/** Default block arrangement for a brand-new property landing/template. */
export function defaultLandingBlocks(): BlockInstance[] {
  return [
    createBlock('hero'),
    createBlock('price_band'),
    createBlock('tech_sheet'),
    createBlock('description'),
    createBlock('gallery'),
    createBlock('finance_simulator'),
    createBlock('lead_form'),
    createBlock('sticky_cta'),
  ];
}

/** Template padrao da PAGINA DE IMOVEL do portal (Produto A). Mais informativo e
 *  SEO que a landing de anuncio: ficha, galeria, infraestrutura, localizacao,
 *  valorizacao, obras entregues, corretor. Usado quando o site ainda nao
 *  customizou o template (editor e render publico caem nele). */
export function defaultPropertyBlocks(): BlockInstance[] {
  return [
    createBlock('hero'),
    createBlock('price_band'),
    createBlock('tech_sheet'),
    createBlock('description'),
    createBlock('gallery'),
    createBlock('amenities'),
    createBlock('apartment_types'),
    createBlock('construction_progress'),
    createBlock('map'),
    createBlock('valuation_history'),
    createBlock('track_record'),
    createBlock('consultant'),
    createBlock('lead_form'),
    createBlock('sticky_cta'),
  ];
}
