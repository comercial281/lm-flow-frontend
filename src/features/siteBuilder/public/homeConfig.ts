// Configuração da página inicial do site (sites.settings['home']).
// O servidor já sanea na gravação e na leitura; aqui o front só se protege de
// servidor velho (sem `home`) ou de lixo, caindo sempre no padrão de fábrica.

export type AbaId = 'sale' | 'rent' | 'launch';
export type CampoBusca = 'type' | 'city' | 'neighborhood' | 'price' | 'bedrooms' | 'suites' | 'parking' | 'stage' | 'code';

/** Ordem fixa dos campos da busca rápida. */
export const CAMPOS_BUSCA: CampoBusca[] = ['type', 'city', 'neighborhood', 'price', 'bedrooms', 'suites', 'parking', 'stage', 'code'];

export interface RegrasVitrine {
  transaction: 'sale' | 'rent' | null;
  listing_kind: 'resale' | 'development' | null;
  property_types: string[];
  cities: string[];
  neighborhoods: string[];
  price_min: number | null;
  price_max: number | null;
  stages: string[];
  featured_only: boolean;
  /** Só imóveis marcados como Minha Casa Minha Vida. Servidor velho não manda: false. */
  mcmv: boolean;
}
export interface Vitrine { id: string; kind: 'launches' | 'featured' | 'custom'; enabled: boolean; title: string; rules?: RegrasVitrine }

export type ChamadaPadraoId = 'financing' | 'listing' | 'wanted';
export interface ChamadaPadrao { enabled: boolean; title: string | null; text: string | null; button: string | null }
export interface ChamadaLivre {
  title: string; text: string | null; button: string | null;
  dest_type: 'page' | 'url' | 'whatsapp'; dest_value: string | null;
}
export interface AtalhoManual {
  label: string; transaction: 'sale' | 'rent' | null; property_type: string | null;
  city: string | null; neighborhood: string | null; price_max: number | null;
}

export interface HomeConfig {
  search: { title: string | null; subtitle: string | null; tabs: Record<AbaId, boolean>; fields: CampoBusca[] };
  showcases: Vitrine[];
  callouts: {
    layout: 'band' | 'photo' | 'cards'; background_url: string | null; overlay: number;
    defaults: Record<ChamadaPadraoId, ChamadaPadrao>; custom: ChamadaLivre[];
  };
  most_searched: { enabled: boolean; mode: 'auto' | 'manual'; items: AtalhoManual[] };
}

export const TEXTO_FABRICA: Record<ChamadaPadraoId, { title: string; text: string; button: string }> = {
  financing: {
    title: 'Financiamento',
    text: 'Simule com os principais bancos e descubra quanto você consegue financiar.',
    button: 'Faça uma simulação',
  },
  listing: {
    title: 'Anuncie seu imóvel',
    text: 'Tem um imóvel para vender ou alugar? Preencha a ficha e a gente avalia.',
    button: 'Cadastre seu imóvel',
  },
  wanted: {
    title: 'Imóvel sob encomenda',
    text: 'Descreva o que você procura e avisamos assim que encontrarmos.',
    button: 'Encomende seu imóvel',
  },
};

export const TITULO_CAPA_FABRICA = 'O imóvel certo pra sua próxima fase.';

const padraoLigado: ChamadaPadrao = { enabled: true, title: null, text: null, button: null };

export const HOME_FABRICA: HomeConfig = {
  search: {
    title: null,
    subtitle: null,
    tabs: { sale: true, rent: true, launch: true },
    fields: ['type', 'city', 'neighborhood', 'bedrooms', 'code'],
  },
  showcases: [
    { id: 'launches', kind: 'launches', enabled: true, title: 'Lançamentos' },
    { id: 'featured', kind: 'featured', enabled: true, title: 'Imóveis em destaque' },
  ],
  callouts: {
    layout: 'band',
    background_url: null,
    overlay: 40,
    defaults: { financing: { ...padraoLigado }, listing: { ...padraoLigado }, wanted: { ...padraoLigado } },
    custom: [],
  },
  most_searched: { enabled: true, mode: 'auto', items: [] },
};

const strOuNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numOuNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function regras(raw: unknown): RegrasVitrine {
  const r = obj(raw);
  return {
    transaction: r.transaction === 'sale' || r.transaction === 'rent' ? r.transaction : null,
    listing_kind: r.listing_kind === 'resale' || r.listing_kind === 'development' ? r.listing_kind : null,
    property_types: strs(r.property_types), cities: strs(r.cities), neighborhoods: strs(r.neighborhoods),
    price_min: numOuNull(r.price_min), price_max: numOuNull(r.price_max),
    stages: strs(r.stages), featured_only: r.featured_only === true, mcmv: r.mcmv === true,
  };
}

// O servidor já sanea, mas um item torto não pode derrubar a home pública:
// cada lista é filtrada pelo formato mínimo e normalizada.
function vitrines(raw: unknown): Vitrine[] {
  if (!Array.isArray(raw)) return HOME_FABRICA.showcases;
  const lista = raw.map((x): Vitrine | null => {
    const v = obj(x);
    if (typeof v.id !== 'string' || !(['launches', 'featured', 'custom'] as const).includes(v.kind as 'custom')) return null;
    const kind = v.kind as Vitrine['kind'];
    const fabrica = HOME_FABRICA.showcases.find(f => f.kind === kind);
    const base: Vitrine = { id: v.id, kind, enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
      title: typeof v.title === 'string' ? v.title : fabrica?.title ?? '' };
    return kind === 'custom' ? { ...base, rules: regras(v.rules) } : base;
  }).filter((v): v is Vitrine => v !== null);
  return lista.length ? lista : HOME_FABRICA.showcases;
}

export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

// Texto que não é texto (número, objeto…) vira null = texto de fábrica: o
// cartão nunca desenha "[object Object]" nem quebra no encodeURIComponent.
function chamadaPadrao(raw: unknown): ChamadaPadrao {
  const o = obj(raw);
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    title: strOuNull(o.title), text: strOuNull(o.text), button: strOuNull(o.button),
  };
}

function chamadasLivres(raw: unknown): ChamadaLivre[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x): ChamadaLivre | null => {
    const o = obj(x);
    if (typeof o.title !== 'string' || !(['page', 'url', 'whatsapp'] as string[]).includes(o.dest_type as string)) return null;
    return {
      title: o.title, text: strOuNull(o.text), button: strOuNull(o.button),
      dest_type: o.dest_type as ChamadaLivre['dest_type'], dest_value: strOuNull(o.dest_value),
    };
  }).filter((c): c is ChamadaLivre => c !== null);
}

// Mesmo cuidado dos textos das chamadas: cidade/bairro/tipo que não são texto
// virariam `.trim()` quebrando a home inteira.
function atalhosManuais(raw: unknown): AtalhoManual[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x): AtalhoManual | null => {
    const o = obj(x);
    if (typeof o.label !== 'string') return null;
    return {
      label: o.label,
      transaction: o.transaction === 'rent' ? 'rent' : o.transaction === 'sale' ? 'sale' : null,
      property_type: strOuNull(o.property_type), city: strOuNull(o.city), neighborhood: strOuNull(o.neighborhood),
      price_max: typeof o.price_max === 'number' && Number.isFinite(o.price_max) ? o.price_max : null,
    };
  }).filter((a): a is AtalhoManual => a !== null);
}

export function resolverHome(raw: unknown): HomeConfig {
  const r = obj(raw);
  const s = obj(r.search), c = obj(r.callouts), m = obj(r.most_searched), d = obj(c.defaults);
  const tabs = obj(s.tabs);
  return {
    search: {
      title: typeof s.title === 'string' ? s.title : null,
      subtitle: typeof s.subtitle === 'string' ? s.subtitle : null,
      tabs: { sale: tabs.sale !== false, rent: tabs.rent !== false, launch: tabs.launch !== false },
      // `fields: []` é válido de propósito: o cliente pode desligar todos os filtros da capa.
      fields: Array.isArray(s.fields) ? CAMPOS_BUSCA.filter(k => (s.fields as string[]).includes(k)) : HOME_FABRICA.search.fields,
    },
    showcases: vitrines(r.showcases),
    callouts: {
      layout: (['band', 'photo', 'cards'] as const).find(x => x === c.layout) ?? 'band',
      background_url: typeof c.background_url === 'string' ? c.background_url : null,
      overlay: typeof c.overlay === 'number' ? c.overlay : 40,
      defaults: { financing: chamadaPadrao(d.financing), listing: chamadaPadrao(d.listing), wanted: chamadaPadrao(d.wanted) },
      custom: chamadasLivres(c.custom),
    },
    most_searched: {
      enabled: m.enabled !== false,
      mode: m.mode === 'manual' ? 'manual' : 'auto',
      items: atalhosManuais(m.items),
    },
  };
}
