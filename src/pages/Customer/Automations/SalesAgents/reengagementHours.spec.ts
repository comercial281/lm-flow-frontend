import { describe, it, expect } from 'vitest';
import { clampReengagementHours } from './reengagementHours';

// O servidor RECUSA hora fora de 1..48. A tela normaliza no blur pra não mandar
// um valor que volta como erro.
describe('clampReengagementHours', () => {
  it('mantém o que está na faixa', () => {
    expect(clampReengagementHours(8, 2)).toBe(8);
  });

  it('prende nas pontas', () => {
    expect(clampReengagementHours(-3, 2)).toBe(1);
    expect(clampReengagementHours(72, 2)).toBe(48);
  });

  it('arredonda hora quebrada', () => {
    expect(clampReengagementHours(2.6, 2)).toBe(3);
  });

  // Igual aos campos de dias do follow-up (`Number(...) || padrão`): o campo
  // apagado chega como 0 e volta pro padrão, não pra 1.
  it('zero, vazio ou lixo volta pro padrão', () => {
    expect(clampReengagementHours(0, 8)).toBe(8);
    expect(clampReengagementHours('', 8)).toBe(8);
    expect(clampReengagementHours(undefined, 2)).toBe(2);
    expect(clampReengagementHours('abc', 2)).toBe(2);
  });
});
