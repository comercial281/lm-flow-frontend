// Configuração da página do imóvel (sites.settings['property_page']).
// Espelho do Sites::PropertyPageConfig do servidor. O servidor já sanea; aqui o
// front só se protege de servidor velho (sem `property_page`) ou de lixo,
// caindo sempre no padrão de fábrica: tudo ligado, a ficha igual à de hoje.
import { obj } from './homeConfig';

export type ChaveRevenda = 'map' | 'popular_badge' | 'values' | 'similar';
export type ChaveEmpreendimento = 'map' | 'popular_badge' | 'stage_and_forecast' | 'typologies' | 'builder' | 'similar';

export const CHAVES_REVENDA: ChaveRevenda[] = ['map', 'popular_badge', 'values', 'similar'];
export const CHAVES_EMPREENDIMENTO: ChaveEmpreendimento[] = ['map', 'popular_badge', 'stage_and_forecast', 'typologies', 'builder', 'similar'];

/** O que o site público recebe. `email_copy` nunca vem no público. */
export interface FichaConfig {
  resale: Record<ChaveRevenda, boolean>;
  development: Record<ChaveEmpreendimento, boolean>;
  financing_badges: boolean;
}

/** O que o admin recebe e grava: o mesmo, mais os e-mails da cópia do contato. */
export interface FichaConfigDoAdmin extends FichaConfig {
  email_copy: string[];
}

const ligadas = <K extends string>(chaves: K[]) => Object.fromEntries(chaves.map(k => [k, true])) as Record<K, boolean>;

export const FICHA_FABRICA: FichaConfig = {
  resale: ligadas(CHAVES_REVENDA),
  development: ligadas(CHAVES_EMPREENDIMENTO),
  financing_badges: true,
};

// Só `false` desliga: ausente, `0`, "false" ou lixo mantêm o padrão (ligado).
// O servidor já converte "false"/0 na gravação, então aqui não chega.
function chaves<K extends string>(lista: K[], raw: unknown): Record<K, boolean> {
  const o = obj(raw);
  return Object.fromEntries(lista.map(k => [k, o[k] !== false])) as Record<K, boolean>;
}

export function resolverFicha(raw: unknown): FichaConfig {
  const r = obj(raw);
  return {
    resale: chaves(CHAVES_REVENDA, r.resale),
    development: chaves(CHAVES_EMPREENDIMENTO, r.development),
    financing_badges: r.financing_badges !== false,
  };
}

/** Versão do admin: mantém os e-mails (só textos; o servidor valida o formato). */
export function resolverFichaDoAdmin(raw: unknown): FichaConfigDoAdmin {
  const r = obj(raw);
  const emails = Array.isArray(r.email_copy) ? r.email_copy.filter((e): e is string => typeof e === 'string') : [];
  return { ...resolverFicha(raw), email_copy: emails };
}
