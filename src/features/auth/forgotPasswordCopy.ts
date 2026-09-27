// "Esqueci minha senha" (Fase 1). A tela responde SEMPRE a mesma frase, exista
// o e-mail ou não — ninguém descobre quem tem conta testando e-mails. O teto de
// pedidos (429) também mostra a frase: o conselho de pedir ao gestor cobre.
export const FORGOT_PASSWORD_SENT = 'Se esse e-mail tiver conta aqui, mandamos um link pro WhatsApp cadastrado.';
export const FORGOT_PASSWORD_HINT = 'Se não chegar em alguns minutos, peça um link novo ao gestor da sua imobiliária.';

export function forgotPasswordOutcome(error: unknown | null): 'sent' | 'failed' {
  if (error == null) return 'sent';
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 429 ? 'sent' : 'failed';
}
