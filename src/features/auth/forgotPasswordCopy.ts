// "Esqueci minha senha" (Fase 1). A tela responde SEMPRE a mesma frase, exista
// o e-mail ou não — ninguém descobre quem tem conta testando e-mails. O teto de
// pedidos (429) também mostra a frase: o conselho de pedir ao gestor cobre.
// Desde 22/10/2026 o link vai só pro e-mail de login (antes ia pro WhatsApp do
// cadastro, e quem não tinha número ficava sem nada).
export const FORGOT_PASSWORD_SENT = 'Se esse e-mail tiver conta aqui, mandamos um link pra ele. Confira também o spam.';
export const FORGOT_PASSWORD_HINT = 'Se não chegar em alguns minutos, peça um link novo ao gestor da sua imobiliária.';

export function forgotPasswordOutcome(error: unknown | null): 'sent' | 'failed' {
  if (error == null) return 'sent';
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 429 ? 'sent' : 'failed';
}
