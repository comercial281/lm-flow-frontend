// Leitor ÚNICO da recusa por cargo (HTTP 403 do RBAC do servidor, corpo
// `{ error, message, required_permission }` — EvoPermissionConcern).
//
// Existe para a tela nunca confundir "o servidor recusou" com "não tem nada":
// o gestor abria IA Vendedora, a leitura era recusada, e a lista vazia mandava
// criar a primeira IA — com duas ligadas. E para nunca culpar o cargo por uma
// queda de rede: só o 403 é recusa.
export type LoadFailure = 'forbidden' | 'failed';

export function isForbiddenError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  return status === 403;
}

export function requiredPermissionOf(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { required_permission?: unknown } } } | null | undefined)?.response
    ?.data;
  return typeof data?.required_permission === 'string' ? data.required_permission : undefined;
}

/**
 * Códigos de recusa (`error.code`) cuja frase o servidor escreve PRA QUEM USA, em
 * português. Lista fechada de propósito: outros 403 (Pundit, etc.) trazem frase
 * técnica em inglês e nunca podem chegar na tela.
 */
export const USER_FACING_CODES = ['OFFER_LOCKED'] as const;

/** Id do aviso da recusa com frase: global e telas usam o mesmo, e o sonner junta. */
export function refusalToastId(message: string): string {
  return `403-${message}`;
}

/**
 * Frase do servidor para uma recusa 403 com código da lista `USER_FACING_CODES`
 * (corpo `{ error: { code, message } }`). Qualquer outra recusa devolve vazio.
 */
export function serverRefusalMessageOf(error: unknown): string | undefined {
  if (!isForbiddenError(error) || requiredPermissionOf(error)) return undefined;
  const data = (error as { response?: { data?: { error?: unknown } } }).response?.data;
  const e = data?.error as { code?: unknown; message?: unknown } | null | undefined;
  if (typeof e?.code !== 'string' || !(USER_FACING_CODES as readonly string[]).includes(e.code)) return undefined;
  return typeof e.message === 'string' && e.message.trim() ? e.message.trim() : undefined;
}

export function classifyLoadFailure(error: unknown): LoadFailure {
  return isForbiddenError(error) ? 'forbidden' : 'failed';
}
