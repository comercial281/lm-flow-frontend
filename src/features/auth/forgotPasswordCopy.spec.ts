import { describe, it, expect } from 'vitest';
import { FORGOT_PASSWORD_SENT, FORGOT_PASSWORD_HINT, forgotPasswordOutcome } from './forgotPasswordCopy';

describe('Esqueci minha senha', () => {
  it('as frases são as da spec', () => {
    expect(FORGOT_PASSWORD_SENT).toBe('Se esse e-mail tiver conta aqui, mandamos um link pro WhatsApp cadastrado.');
    expect(FORGOT_PASSWORD_HINT).toBe('Se não chegar em alguns minutos, peça um link novo ao gestor da sua imobiliária.');
  });

  it('resposta do servidor (e o teto de pedidos) mostram a mesma frase', () => {
    expect(forgotPasswordOutcome(null)).toBe('sent');
    expect(forgotPasswordOutcome({ response: { status: 429 } })).toBe('sent');
  });

  it('servidor fora do ar ou rede caída é erro de verdade', () => {
    expect(forgotPasswordOutcome({ response: { status: 500 } })).toBe('failed');
    expect(forgotPasswordOutcome(new Error('Network Error'))).toBe('failed');
  });
});
