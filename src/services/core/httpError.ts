/** O status HTTP de um erro do cliente HTTP, sem `any` na tela. 403 tem que ser
 *  distinguível: engolir o erro e mostrar "sem passos agendados" foi o que fez a
 *  linha do tempo parecer vazia para quem só não tinha permissão. */
export const httpStatusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

/** A primeira mensagem de erro que o servidor mandou, quando mandou alguma. */
export const serverErrorOf = (error: unknown): string | undefined =>
  (error as { response?: { data?: { errors?: string[] } } } | undefined)
    ?.response?.data?.errors?.[0];
