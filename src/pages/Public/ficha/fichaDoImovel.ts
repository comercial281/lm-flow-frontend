// Regras da página do imóvel (C2): o que aparece, conforme o cadastro e a
// "Página do imóvel" do Personalizar. Tudo aqui é puro; a página só desenha.
// Servidor velho não manda nenhum destes campos: cada função devolve vazio e a
// ficha fica igual à de antes.
import { tipoDoImovel, seloDaFase, type ListingKind } from '@/features/properties/listingKind';
import type { FichaConfig } from '@/features/siteBuilder/public/fichaConfig';

export interface CamposDaFicha {
  listing_kind?: string | null;
  stage?: string | null;
  delivery_forecast?: string | null;
  accepts_financing?: boolean | null;
  accepts_fgts?: boolean | null;
  mcmv?: boolean | null;
  popular?: boolean | null;
  video_url?: string | null;
  virtual_tour_url?: string | null;
  builder?: { name?: string | null; website?: string | null } | null;
  towers?: number | null;
  floors?: number | null;
  total_units?: number | null;
  building_standard?: string | null;
  construction_year?: number | null;
  iptu_period?: string | null;
}

/** O que a "Página do imóvel" liga para este imóvel (revenda ou empreendimento). */
export interface FichaDoImovel {
  tipo: ListingKind;
  mapa: boolean;
  parecidos: boolean;
  valores: boolean;
  tipologias: boolean;
  fase: boolean;
  construtora: boolean;
  muitoProcurado: boolean;
  selosDeFinanciamento: boolean;
}

export function fichaDoImovel(p: CamposDaFicha, cfg: FichaConfig): FichaDoImovel {
  const tipo = tipoDoImovel(p);
  const e = tipo === 'development';
  const chaves = e ? cfg.development : cfg.resale;
  return {
    tipo,
    mapa: chaves.map,
    parecidos: chaves.similar,
    // Condomínio/IPTU/m² só têm chave na revenda; tipologias, fase e
    // construtora só no empreendimento. Fora da sua chave, ficam como hoje.
    valores: e ? true : cfg.resale.values,
    tipologias: e ? cfg.development.typologies : true,
    fase: e && cfg.development.stage_and_forecast,
    construtora: e && cfg.development.builder,
    muitoProcurado: chaves.popular_badge,
    selosDeFinanciamento: cfg.financing_badges,
  };
}

export interface Selo { texto: string; destaque: boolean }

/** Selos abaixo do título. Só `true` no cadastro mostra; `null`/`false` não. */
export function selosDoImovel(p: CamposDaFicha, f: FichaDoImovel): Selo[] {
  const out: Selo[] = [];
  if (f.muitoProcurado && p.popular === true) out.push({ texto: 'Muito procurado', destaque: true });
  if (f.selosDeFinanciamento) {
    if (p.accepts_financing === true) out.push({ texto: 'Aceita financiamento', destaque: false });
    if (p.accepts_fgts === true) out.push({ texto: 'Aceita FGTS', destaque: false });
    if (p.mcmv === true) out.push({ texto: 'Minha Casa Minha Vida', destaque: false });
  }
  return out;
}

/** "Em obra · entrega mar/2027" do empreendimento; sem fase no cadastro, nada. */
export function faseDoImovel(p: CamposDaFicha, f: FichaDoImovel): string | null {
  if (!f.fase || !p.stage) return null;
  return seloDaFase(p.stage, p.delivery_forecast);
}

export const ROTULO_PADRAO: Record<string, string> = {
  economic: 'Econômico', medium: 'Médio', high: 'Alto', luxury: 'Luxo',
};

const contagem = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n.toLocaleString('pt-BR') : null);

/** Dados do prédio do empreendimento: só os que existem no cadastro. */
export function dadosDoPredio(p: CamposDaFicha, f: FichaDoImovel): { rotulo: string; valor: string }[] {
  if (f.tipo !== 'development') return [];
  // Só chave própria: um "constructor" ou "toString" vindo no campo não vira rótulo.
  // (Object.hasOwn é ES2022; o tsconfig do app está em ES2020.)
  const padrao = p.building_standard && Object.prototype.hasOwnProperty.call(ROTULO_PADRAO, p.building_standard)
    ? ROTULO_PADRAO[p.building_standard] : null;
  const pares: [string, string | null][] = [
    ['Torres', contagem(p.towers)],
    ['Andares', contagem(p.floors)],
    ['Unidades', contagem(p.total_units)],
    ['Padrão', padrao],
  ];
  return pares.flatMap(([rotulo, valor]) => (valor ? [{ rotulo, valor }] : []));
}

function siteHttp(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw.trim() : null;
  } catch {
    return null;
  }
}

/** Construtora: nome e, se for http(s), o site. Sem nome, nada. */
export function construtoraDoImovel(p: CamposDaFicha, f: FichaDoImovel): { nome: string; site: string | null } | null {
  if (!f.construtora) return null;
  const nome = typeof p.builder?.name === 'string' ? p.builder.name.trim() : '';
  if (!nome) return null;
  return { nome, site: siteHttp(p.builder?.website) };
}

/** Sufixo do IPTU: mensal quando o cadastro diz; senão anual, como sempre foi. */
export function sufixoDoIptu(p: CamposDaFicha): string {
  return p.iptu_period === 'monthly' ? '/mês' : '/ano';
}
