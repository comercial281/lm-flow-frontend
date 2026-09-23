// O que a tela de login DIZ quando não dá para entrar.
//
// Por que isto existe (22/09/2026): a tela mostrava "Credenciais inválidas"
// para QUALQUER falha — senha errada, acesso suspenso, internet caída, servidor
// fora do ar, e até para login APROVADO que travou depois. Ela procurava o
// motivo do servidor no lugar errado (ele manda dentro de `error`), então nunca
// o encontrava e caía sempre na mesma frase.
//
// O custo disso foi real: várias corretoras não entravam pelo iPhone, e a única
// pista que o gestor tinha acusava a senha — que estava certa. Foram três
// rodadas de investigação por causa de uma frase que afirmava o que a tela não
// tinha como saber.
//
// Regra da casa (já registrada no caso do relatório da semana): **frase de
// reserva nunca afirma a causa**. Sem motivo do servidor, o que a tela sabe é
// só que o pedido não voltou — e é isso que ela diz.

import { extractError } from '@/utils/apiHelpers';

export interface LoginFeedback {
  /** Título do aviso. */
  title: string;
  /** Explicação — do servidor quando ele mandou uma. */
  description: string;
  /** O servidor chegou a responder com um motivo? */
  fromServer: boolean;
}

const SEM_RESPOSTA =
  'O servidor não respondeu a este pedido. Confira sua conexão e tente de novo em alguns instantes.';

/**
 * O servidor chegou a EXPLICAR alguma coisa?
 *
 * A pergunta é estrutural, não uma lista de frases proibidas: só conta como
 * explicação o que veio dentro do corpo da resposta, nos dois formatos que a
 * API usa. Sem isso, um erro de rede (cuja mensagem é texto técnico em inglês)
 * seria exibido como se fosse o diagnóstico do servidor — que é a família do
 * defeito que esta função veio resolver.
 */
function explicacaoDoServidor(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') return '';

  const corpo = data as { error?: unknown; message?: unknown };
  const temMotivo =
    (typeof corpo.error === 'object' && corpo.error !== null) ||
    (typeof corpo.error === 'string' && corpo.error.trim() !== '') ||
    (typeof corpo.message === 'string' && corpo.message.trim() !== '');
  if (!temMotivo) return '';

  // A leitura dos dois formatos continua sendo do utilitário da casa.
  return (extractError(error)?.message ?? '').trim();
}

export function loginFeedback(error: unknown): LoginFeedback {
  const bruta = explicacaoDoServidor(error);

  if (!bruta) {
    return { title: 'Não consegui entrar', description: SEM_RESPOSTA, fromServer: false };
  }

  // O servidor explicou: a explicação dele é o que aparece, sem nada por cima.
  return { title: 'Não consegui entrar', description: bruta, fromServer: true };
}

export default loginFeedback;
