// src/features/siteBuilder/public/limiteDeEnvios.ts
// Limite de envios dos formulários públicos (site e landing de anúncio).
//
// Desde 11/10/2026 o servidor aceita 10 envios a cada 10 minutos por
// visitante em `site/leads`, `site/anuncie` e `landing/:slug/leads`. Passou
// disso, ele responde 429 com
// `{ error: { code: "TOO_MANY_REQUESTS", message: "Muitos envios seguidos..." } }`
// e o cabeçalho `Retry-After`. Sem este ajudante as telas mostravam a frase de
// falha de conexão ("toque em enviar de novo"), e tentar de novo só prolongava
// o bloqueio.
//
// Uma regra só para todas as telas: no 429 vale a frase que o servidor mandou
// (com reserva igual aqui, se ela não vier); qualquer outro erro continua com a
// frase própria de cada tela.
//
// Não importa nada: o site no domínio do cliente e a landing são pacotes enxutos.

/** Reserva da frase do servidor, igual à dele. */
export const TEXTO_LIMITE_DE_ENVIOS = 'Muitos envios seguidos. Tente de novo em alguns minutos.';

/** Frase das telas do site para falha que NÃO é o limite (rede, servidor fora). */
export const TEXTO_FALHA_DE_ENVIO = 'Não consegui enviar agora. Tente de novo em instantes.';

/** Teto da espera lida do `Retry-After`: valor maluco não trava o botão por horas. */
const ESPERA_MAXIMA_SEGUNDOS = 15 * 60;

export interface LimiteDeEnvios {
  /** Frase para mostrar à pessoa. */
  mensagem: string;
  /** Quanto falta para o servidor aceitar de novo, se ele disse. */
  esperarSegundos: number | null;
}

/**
 * Segundos do `Retry-After`, que pode vir em segundos ("120") ou como data
 * HTTP. Ausente, inválido ou já passado: null.
 */
export function segundosDoRetryAfter(valor: string | null | undefined, agora: number = Date.now()): number | null {
  const v = (valor ?? '').trim();
  if (!v) return null;
  let segundos: number;
  if (/^\d+$/.test(v)) {
    segundos = Number(v);
  } else {
    const quando = Date.parse(v);
    if (Number.isNaN(quando)) return null;
    segundos = Math.ceil((quando - agora) / 1000);
  }
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  return Math.min(segundos, ESPERA_MAXIMA_SEGUNDOS);
}

/**
 * A resposta é o limite de envios (429)? Devolve a frase e a espera; qualquer
 * outra resposta devolve null (e o corpo dela não é lido).
 */
export async function lerLimiteDeEnvios(res: Pick<Response, 'status'> & Partial<Pick<Response, 'headers' | 'json'>>): Promise<LimiteDeEnvios | null> {
  if (res?.status !== 429) return null;
  let mensagem = '';
  try {
    const corpo = (await res.json?.()) as { error?: { message?: unknown } } | undefined;
    const m = corpo?.error?.message;
    if (typeof m === 'string') mensagem = m.trim().slice(0, 240);
  } catch {
    /* sem corpo JSON: fica a reserva */
  }
  let retryAfter: string | null = null;
  try {
    retryAfter = res.headers?.get?.('Retry-After') ?? null;
  } catch {
    retryAfter = null;
  }
  return {
    mensagem: mensagem || TEXTO_LIMITE_DE_ENVIOS,
    esperarSegundos: segundosDoRetryAfter(retryAfter),
  };
}

/**
 * A frase de erro do envio: a do limite quando é 429, senão a da própria tela.
 * Atalho para as telas que não precisam da espera.
 */
export async function textoDoErroDeEnvio(res: Parameters<typeof lerLimiteDeEnvios>[0], textoDaTela: string): Promise<string> {
  return (await lerLimiteDeEnvios(res))?.mensagem ?? textoDaTela;
}
