// O motivo da recusa da API, para o toast do Aceitar/Recusar. Mora num lugar só
// porque o selo (OfferActions) e o pop-up de aceite (OfferPopup) mostram o mesmo
// erro das mesmas duas chamadas.
//
// A API tem DOIS formatos de erro: `error.message` (padrão) e a recusa por
// cargo, que devolve `error` como texto e a explicação em `message`. Ler só o
// primeiro mostra a frase genérica no lugar de "seu cargo não permite".
export function reasonOf(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const err = data?.error;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof err === 'string') return err;
  return fallback;
}
