import { describe, it, expect, beforeEach } from 'vitest';
import {
  esquecerConfianca,
  guardarConfianca,
  lerConfianca,
  pareceCodigoReserva,
  textoDosCodigosReserva,
} from './mfaTrust';

describe('confiar neste navegador (verificação em duas etapas)', () => {
  beforeEach(() => localStorage.clear());

  it('guarda o passe por e-mail, sem diferença de maiúscula e espaço', () => {
    guardarConfianca('Ana@Cliente.com ', 'passe-1');
    expect(lerConfianca('ana@cliente.com')).toBe('passe-1');
    expect(lerConfianca('outra@cliente.com')).toBeUndefined();
  });

  it('esquece quando pedido e ignora passe vazio', () => {
    guardarConfianca('ana@cliente.com', '');
    expect(lerConfianca('ana@cliente.com')).toBeUndefined();
    guardarConfianca('ana@cliente.com', 'passe-2');
    esquecerConfianca('ana@cliente.com');
    expect(lerConfianca('ana@cliente.com')).toBeUndefined();
  });
});

describe('código reserva', () => {
  it('reconhece 8 caracteres com letra, com ou sem traço', () => {
    expect(pareceCodigoReserva('ab2c-de3f')).toBe(true);
    expect(pareceCodigoReserva('AB2CDE3F')).toBe(true);
    expect(pareceCodigoReserva('12345678')).toBe(false);
    expect(pareceCodigoReserva('123456')).toBe(false);
  });

  it('o arquivo baixado lista a conta e os códigos numerados', () => {
    const texto = textoDosCodigosReserva(['aaaa-bbbb', 'cccc-dddd'], 'ana@cliente.com', new Date(2026, 10, 14));
    expect(texto).toContain('Conta: ana@cliente.com');
    expect(texto).toContain('14/11/2026');
    expect(texto).toContain(' 1. aaaa-bbbb');
    expect(texto).toContain(' 2. cccc-dddd');
  });
});
