import { describe, expect, it } from 'vitest';
import { phoneDigits, toE164 } from './phoneValue';

describe('phoneDigits', () => {
  it('tira máscara e o +', () => {
    expect(phoneDigits('+55 (11) 99999-9999')).toBe('5511999999999');
    expect(phoneDigits('')).toBe('');
    expect(phoneDigits(null)).toBe('');
  });
});

describe('toE164', () => {
  it('mantém o que já está em E.164', () => {
    expect(toE164('+5511999999999')).toBe('+5511999999999');
    expect(toE164('+1 415 555 0100')).toBe('+14155550100');
  });

  it('número com país e sem + ganha o +', () => {
    expect(toE164('5511999999999')).toBe('+5511999999999');
  });

  it('número antigo só com DDD ganha o 55', () => {
    expect(toE164('11999999999')).toBe('+5511999999999');
    expect(toE164('(11) 3333-4444')).toBe('+551133334444');
  });

  it('vazio continua vazio', () => {
    expect(toE164('')).toBe('');
    expect(toE164(undefined)).toBe('');
    expect(toE164('abc')).toBe('');
  });
});
