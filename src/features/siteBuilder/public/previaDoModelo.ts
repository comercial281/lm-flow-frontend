// src/features/siteBuilder/public/previaDoModelo.ts
// Prévia do modelo (Meu site › Modelo do site · "Ver prévia").
//
// O painel abre `<endereço do site>?modelo=<classico|editorial|popular>` (com
// o `?previa=` junto quando o site está em manutenção). Aqui o site lê o
// `?modelo=`, guarda em `sessionStorage['lmf-modelo']` (a navegação interna
// perde a busca da URL) e aplica o modelo SÓ no navegador, por cima do site
// que o servidor mandou: fonte, `appearance`, `home` e `listing`, pela mesma
// receita do botão "Usar este modelo" (`aplicarModelo`). Nada é gravado e
// qualquer um pode abrir: é só visual.
//
// Na prévia do modelo: faixa "Prévia do modelo X. Nada foi salvo.",
// `noindex`, sem visita e sem rastreamento. Sem `?modelo=` o site sai
// idêntico (o mesmo objeto).
//
// Só importa `../modelosDoSite` e os `./*Config`: o site no domínio do
// cliente é um pacote enxuto (ver scripts/conferir-dominio-limpo.mjs).
import { MODELOS_DO_SITE, aplicarModelo, type ModeloDoSiteId } from '../modelosDoSite';
import { resolverAparencia } from './aparenciaConfig';
import { resolverHome } from './homeConfig';
import { resolverLista } from './listaConfig';

export const CHAVE_DO_MODELO = 'lmf-modelo';
export const PARAM_DO_MODELO = 'modelo';

// Storage bloqueado (aba anônima, política do navegador): fica na memória.
let memoria: ModeloDoSiteId | null = null;

function sessao(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function limpo(v: string | null | undefined): ModeloDoSiteId | null {
  const t = (v ?? '').trim();
  return MODELOS_DO_SITE.find(m => m.id === t)?.id ?? null;
}

/**
 * O modelo em prévia nesta aba: o `?modelo=` da URL (que passa a valer e é
 * guardado) ou o guardado antes. Valor fora da lista não conta. Sem modelo, null.
 */
export function modeloDaPrevia(loc: { search: string } = window.location): ModeloDoSiteId | null {
  let daUrl: ModeloDoSiteId | null = null;
  try {
    daUrl = limpo(new URLSearchParams(loc.search).get(PARAM_DO_MODELO));
  } catch {
    daUrl = null;
  }
  if (daUrl) {
    memoria = daUrl;
    try {
      sessao()?.setItem(CHAVE_DO_MODELO, daUrl);
    } catch {
      /* bloqueado: segue na memória */
    }
    return daUrl;
  }
  try {
    const salvo = limpo(sessao()?.getItem(CHAVE_DO_MODELO));
    if (salvo) return salvo;
  } catch {
    /* bloqueado */
  }
  return memoria;
}

/** O pedaço do site que a prévia do modelo lê e troca. */
interface SiteComVisual {
  branding?: { font_family?: string | null } | null;
  appearance?: unknown;
  home?: unknown;
  listing?: unknown;
  modelo_em_previa?: ModeloDoSiteId;
}

/**
 * O site com o modelo da prévia aplicado (fonte, `appearance`, `home` e
 * `listing`) e a marca `modelo_em_previa`. Sem modelo, o MESMO objeto.
 */
export function comModeloDaPrevia<T extends SiteComVisual>(site: T): T {
  const id = modeloDaPrevia();
  if (!id) return site;
  const visual = aplicarModelo(id, {
    font_family: site.branding?.font_family ?? null,
    appearance: resolverAparencia(site.appearance),
    home: resolverHome(site.home),
    listing: resolverLista(site.listing),
  });
  return {
    ...site,
    branding: { ...site.branding, font_family: visual.font_family },
    appearance: visual.appearance,
    home: visual.home,
    listing: visual.listing,
    modelo_em_previa: id,
  };
}

/** O site está na prévia de um modelo (veio por `comModeloDaPrevia`). */
export function ehPreviaDoModelo(site: { modelo_em_previa?: string | null } | null | undefined): boolean {
  return !!limpo(site?.modelo_em_previa);
}

/** Nome do modelo pra faixa ("Editorial"). */
export function nomeDoModelo(id: ModeloDoSiteId): string {
  return MODELOS_DO_SITE.find(m => m.id === id)?.nome ?? id;
}

/** Só para teste: esquece o modelo da memória. */
export function esquecerModeloDaPrevia(): void {
  memoria = null;
}
