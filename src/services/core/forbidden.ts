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
 * Recusa do servidor que NÃO é de cargo mas traz a própria explicação (ex.: "Aceite o
 * lead pra editar os dados dele."). Corpo `{ error: { message } }` ou `{ message }`.
 * Recusa de cargo (com `required_permission`) devolve vazio: essa tem texto próprio.
 */
export function serverRefusalMessageOf(error: unknown): string | undefined {
  if (!isForbiddenError(error) || requiredPermissionOf(error)) return undefined;
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data;
  const aninhada = (data?.error as { message?: unknown } | null | undefined)?.message;
  for (const candidata of [aninhada, data?.message]) {
    if (typeof candidata === 'string' && candidata.trim()) return candidata.trim();
  }
  return undefined;
}

export function classifyLoadFailure(error: unknown): LoadFailure {
  return isForbiddenError(error) ? 'forbidden' : 'failed';
}
