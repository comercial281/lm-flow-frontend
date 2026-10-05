// src/features/siteBuilder/public/previa.ts
// Prévia do site antes de publicar (Meu site · "Ver prévia").
//
// O painel pede um link assinado ao servidor (`POST /sites/:id/preview_link`,
// vale 24 h) e abre `<endereço do site>?previa=<token>`. Aqui o site lê o
// `?previa=`, guarda em `sessionStorage['lmf-previa']` (a navegação interna
// perde a busca da URL) e manda o token em `X-Site-Preview` em toda chamada
// pública. Token válido: o servidor devolve o site inteiro com `preview: true`
// e as listas deixam passar. Token vencido, de outro site ou adulterado vale
// como se não houvesse token.
//
// Na prévia: faixa "Prévia: o site ainda não está publicado.", `noindex`, sem
// visita e sem nenhum rastreamento (GA4, Pixel, GTM, códigos).
//
// Não importa nada: o site no domínio do cliente é um pacote enxuto.

export const CHAVE_DA_PREVIA = 'lmf-previa';
export const PARAM_DA_PREVIA = 'previa';

/** Token como header HTTP: só caractere visível, sem espaço, com teto. */
const TOKEN_VALIDO = /^[\x21-\x7E]{1,2048}$/;

// Storage bloqueado (aba anônima, política do navegador): fica na memória.
let memoria: string | null = null;

function sessao(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function limpo(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return TOKEN_VALIDO.test(t) ? t : null;
}

/**
 * O token da prévia desta aba: o `?previa=` da URL (que passa a valer e é
 * guardado) ou o guardado antes. Sem token, null.
 */
export function tokenDaPrevia(loc: { search: string } = window.location): string | null {
  let daUrl: string | null = null;
  try {
    daUrl = limpo(new URLSearchParams(loc.search).get(PARAM_DA_PREVIA));
  } catch {
    daUrl = null;
  }
  if (daUrl) {
    memoria = daUrl;
    try {
      sessao()?.setItem(CHAVE_DA_PREVIA, daUrl);
    } catch {
      /* bloqueado: segue na memória */
    }
    return daUrl;
  }
  try {
    const salvo = limpo(sessao()?.getItem(CHAVE_DA_PREVIA));
    if (salvo) return salvo;
  } catch {
    /* bloqueado */
  }
  return memoria;
}

/**
 * Cabeçalhos de toda chamada pública do site: `X-Tenant` e, com prévia,
 * `X-Site-Preview`. `extra` entra antes (ex.: `Content-Type`).
 */
export function cabecalhosDoSite(tenant: string, extra: Record<string, string> = {}): Record<string, string> {
  const token = tokenDaPrevia();
  return { ...extra, 'X-Tenant': tenant, ...(token ? { 'X-Site-Preview': token } : {}) };
}

/** O site veio como prévia (o servidor aceitou o token). Só `true` conta. */
export function ehPrevia(site: { preview?: boolean | null } | null | undefined): boolean {
  return site?.preview === true;
}

/** Só para teste: esquece o token da memória. */
export function esquecerPrevia(): void {
  memoria = null;
}
