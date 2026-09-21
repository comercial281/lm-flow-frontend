/**
 * Por que uma ação da IA Vendedora falhou — em português, e sem inventar causa.
 *
 * ⚠️ ESTA FUNÇÃO É A CICATRIZ DE UM CICLO DE SEIS CONSERTOS (21/09/2026). A versão
 * anterior devolvia NULO sempre que a resposta não trazia um motivo legível, e a tela
 * caía numa frase de reserva que não diz nada ("Não consegui rodar o diagnóstico").
 * Com isso, CINCO falhas completamente diferentes chegavam ao gestor idênticas:
 *
 *   - o servidor não conhece o endereço (404: a metade do servidor ainda não subiu);
 *   - o servidor quebrou ao responder (500);
 *   - a hospedagem derrubou a requisição antes de o servidor responder (502/504);
 *   - a requisição passou do teto de tempo do servidor (que não devolve corpo nenhum);
 *   - o navegador nem conseguiu falar com o servidor (rede, CORS, servidor fora).
 *
 * Nenhuma delas se conserta do mesmo jeito, e a tela não dava nem o código para
 * separá-las — então cada rodada de diagnóstico era adivinhação. Agora, quando não há
 * motivo escrito, a tela diz O QUE ACONTECEU: o código que voltou, ou que não houve
 * resposta nenhuma.
 *
 * A regra que isto respeita, e que continua valendo: **a tela nunca AFIRMA a causa**.
 * "O servidor respondeu 404" é um fato; "a tabela não existe" seria um chute.
 */

/** O motivo que o servidor escreveu, quando existe. A API tem DOIS formatos. */
export function motivoEscrito(e: unknown): string | null {
  const data = (e as { response?: { data?: unknown } })?.response?.data as
    | { error?: unknown; message?: unknown }
    | undefined;
  if (!data || typeof data !== 'object') return null;

  // O padrão da API: { error: { code, message } }.
  const doErro = (data.error as { message?: unknown } | undefined)?.message;
  if (typeof doErro === 'string' && doErro.trim()) return doErro;

  // A recusa por cargo: `error` como TEXTO e a explicação em `message`, no topo.
  if (typeof data.message === 'string' && data.message.trim()) return data.message;

  return null;
}

/**
 * O fato bruto, quando não há motivo escrito: o código que o servidor devolveu, ou a
 * ausência de resposta. É isto que permite a quem lê separar "não subiu" de "quebrou"
 * de "não respondeu".
 */
export function fatoDaFalha(e: unknown): string {
  const status = (e as { response?: { status?: unknown } })?.response?.status;

  if (typeof status !== 'number') {
    return 'O navegador não conseguiu falar com o servidor (sem resposta). Pode ser rede, ' +
      'o servidor fora do ar, ou a requisição barrada antes de chegar nele.';
  }

  if (status === 404) {
    return 'O servidor respondeu 404: ele não conhece este endereço. Normalmente é a ' +
      'metade do servidor ainda não publicada — confira se o deploy do backend subiu.';
  }
  if (status === 401 || status === 403) {
    return `O servidor recusou o acesso (${status}), e não disse o motivo.`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `A hospedagem respondeu ${status} antes de o servidor responder: ele está ` +
      'reiniciando, fora do ar, ou demorou demais.';
  }
  if (status >= 500) {
    return `O servidor quebrou ao responder (${status}) e não explicou. O motivo fica no ` +
      'log do servidor.';
  }
  return `O servidor respondeu ${status} sem explicar o motivo.`;
}

/**
 * O que mostrar ao gestor: o motivo escrito pelo servidor quando existe, senão o fato.
 * NUNCA devolve vazio — uma tela que falha sem dizer nada é o defeito que esta função
 * veio acabar.
 */
export function motivoDaFalha(e: unknown, oQueFalhou?: string): string {
  const escrito = motivoEscrito(e);
  if (escrito) return escrito;

  const prefixo = oQueFalhou ? `${oQueFalhou} ` : '';
  return `${prefixo}${fatoDaFalha(e)}`;
}
