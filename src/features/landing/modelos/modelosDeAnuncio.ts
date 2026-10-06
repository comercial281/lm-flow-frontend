import {
  DEFAULT_LEAD_FORM_STEPS,
  createBlock,
  type BlockConfig,
  type BlockInstance,
  type BlockType,
  type LandingTheme,
} from '@/features/landing/blocks';
import { PERGUNTAS_ALUGUEL, PERGUNTAS_REVENDA } from './perguntas';

export type ModeloDeAnuncioId = 'lancamento' | 'revenda' | 'aluguel';

export interface ModeloDeAnuncio {
  id: ModeloDeAnuncioId;
  nome: string;
  /** Uma linha, para o cartão do assistente. */
  frase: string;
  tema: LandingTheme;
  /** Blocos novos a cada chamada (ids novos): duas páginas nunca dividem id. */
  blocos: () => BlockInstance[];
}

/** Bloco do tipo pedido com o config padrão e as chaves de `config` por cima. */
function bloco<T extends BlockType>(
  tipo: T,
  config: Partial<BlockConfig<T>> = {},
  visible = true,
): BlockInstance {
  const b = createBlock(tipo);
  return { ...b, visible, config: { ...b.config, ...config } } as BlockInstance;
}

/** Capa com o formulário dentro, logo seguida do formulário: o lead não rola
 *  para achar onde preencher (regra do Tony para página de anúncio). */
function capaEFormulario(form: Partial<BlockConfig<'lead_form'>>): BlockInstance[] {
  return [bloco('hero', { formInHero: true }), bloco('lead_form', form)];
}

const CAMPOS_REVENDA: BlockConfig<'tech_sheet'>['fields'] = [
  'bedrooms', 'suites', 'bathrooms', 'parking_spaces', 'useful_area_m2',
];

export const MODELOS_DE_ANUNCIO: ModeloDeAnuncio[] = [
  {
    id: 'lancamento',
    nome: 'Lançamento',
    frase: 'Empreendimento na planta ou em obras.',
    tema: {
      primary: '#F59E0B', accent: '#FBBF24', bgStart: '#0F172A', bgEnd: '#0B1120', blockBg: '#111827',
      cardBg: '#1F2937', border: '#334155', muted: '#94A3B8', icon: '#F59E0B', text: '#F8FAFC',
      fontFamily: 'Montserrat, sans-serif',
    },
    blocos: () => [
      ...capaEFormulario({
        title: 'Receba a tabela de preços',
        ctaLabel: 'Quero a tabela',
        contactTitle: 'Para onde mandamos a tabela?',
        steps: DEFAULT_LEAD_FORM_STEPS,
      }),
      bloco('price_band'),
      bloco('tech_sheet', { fields: ['bedrooms', 'suites', 'parking_spaces', 'useful_area_m2', 'delivery', 'units'] }),
      bloco('apartment_types', { title: 'Plantas' }),
      // O percentual da obra é manual: nasce escondido até alguém preencher.
      bloco('construction_progress', { title: 'Fase da obra' }, false),
      bloco('amenities', { title: 'Lazer e diferenciais' }),
      bloco('gallery'),
      bloco('description'),
      bloco('map'),
      bloco('consultant'),
      bloco('sticky_cta', { label: 'Receber a tabela' }),
    ],
  },
  {
    id: 'revenda',
    nome: 'Revenda',
    frase: 'Imóvel pronto, usado ou novo.',
    tema: {
      primary: '#0E7C5A', accent: '#10B981', bgStart: '#FFFFFF', bgEnd: '#F8FAFC', blockBg: '#FFFFFF',
      cardBg: '#F1F5F9', border: '#E2E8F0', muted: '#64748B', icon: '#0E7C5A', text: '#0F172A',
      fontFamily: 'DM Sans, sans-serif',
    },
    blocos: () => [
      ...capaEFormulario({
        title: 'Agende uma visita',
        ctaLabel: 'Agendar visita',
        contactTitle: 'Quem vai visitar?',
        steps: PERGUNTAS_REVENDA,
      }),
      bloco('price_band'),
      bloco('tech_sheet', { fields: CAMPOS_REVENDA }),
      bloco('gallery'),
      bloco('description', { title: 'Sobre o imóvel' }),
      bloco('amenities', { title: 'Diferenciais' }),
      bloco('map'),
      bloco('consultant'),
      bloco('sticky_cta', { label: 'Agendar visita' }),
    ],
  },
  {
    id: 'aluguel',
    nome: 'Aluguel',
    frase: 'Imóvel para alugar, com o custo do mês.',
    tema: {
      primary: '#C2410C', accent: '#FB923C', bgStart: '#FFFBF5', bgEnd: '#FFF7ED', blockBg: '#FFFFFF',
      cardBg: '#FFF7ED', border: '#FED7AA', muted: '#78716C', icon: '#C2410C', text: '#1C1917',
      fontFamily: 'Nunito, sans-serif',
    },
    blocos: () => [
      ...capaEFormulario({
        title: 'Agende uma visita',
        ctaLabel: 'Agendar visita',
        contactTitle: 'Quem vai visitar?',
        steps: PERGUNTAS_ALUGUEL,
      }),
      bloco('price_band'),
      bloco('monthly_cost', { extras: [] }),
      bloco('tech_sheet', { fields: CAMPOS_REVENDA }),
      bloco('steps', {
        title: 'Como alugar',
        items: [
          { title: 'Visite', text: 'Escolha o melhor horário e conheça o imóvel.' },
          { title: 'Envie os documentos', text: 'A gente confere tudo e te ajuda com a garantia.' },
          { title: 'Assine e pegue as chaves', text: 'Contrato digital, sem ir ao cartório.' },
        ],
      }),
      bloco('amenities', { title: 'Garantias aceitas', items: ['Fiador', 'Seguro fiança', 'Caução'] }),
      bloco('amenities', { title: 'Documentos', items: ['RG e CPF', 'Comprovante de renda', 'Comprovante de residência'] }),
      bloco('gallery'),
      bloco('description', { title: 'Sobre o imóvel' }),
      bloco('map'),
      bloco('sticky_cta', { label: 'Agendar visita' }),
    ],
  },
];

/** Locação ou temporada pede o Aluguel; empreendimento, o Lançamento; o resto,
 *  Revenda. Só sugere: quem escolhe é a pessoa. */
export function modeloSugerido(p: { listing_kind?: string | null; transaction_type?: string | null }): ModeloDeAnuncioId {
  if (p.transaction_type === 'rent' || p.transaction_type === 'season') return 'aluguel';
  if (p.listing_kind === 'development') return 'lancamento';
  return 'revenda';
}
