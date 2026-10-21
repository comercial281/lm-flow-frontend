// Follow-up: uma porta só (Fase 2). Tirar o tipo "Follow-up" de uma coluna que
// ainda tem lead em follow-up volta 422 com `error.details` vindo do
// `errors.full_messages` do servidor, com o nome do campo na frente
// ("Stage type Tem lead em follow-up nesta coluna. Pare os follow-ups ou mova os
// cards antes."). Só essa frase vai pra tela, sem o prefixo; qualquer outro erro
// de validação segue no aviso genérico da tela.

const FRASE_DA_COLUNA_OCUPADA = /Tem lead em follow-up nesta coluna.*$/;

export function mensagemDaColunaDeFollowup(error: unknown): string | null {
  const details = (error as { response?: { data?: { error?: { details?: unknown } } } })?.response?.data?.error?.details;
  const lista = Array.isArray(details) ? details : typeof details === 'string' ? [details] : [];
  for (const item of lista) {
    if (typeof item !== 'string') continue;
    const achou = item.match(FRASE_DA_COLUNA_OCUPADA);
    if (achou) return achou[0];
  }
  return null;
}
