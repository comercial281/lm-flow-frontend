import { describe, it, expect } from 'vitest';
import { fraseDoCampo, FRASE_DESCONECTADO, FRASE_JANELA_FECHADA } from './fraseDoCampo';

const base = {
  pendente: false,
  desconectado: false,
  janelaFechada: false,
  textoPendente: 'pendente',
  textoPadrao: 'padrão',
};

describe('fraseDoCampo', () => {
  it('normal e pendente mantêm os textos de hoje', () => {
    expect(fraseDoCampo(base)).toBe('padrão');
    expect(fraseDoCampo({ ...base, pendente: true, desconectado: true })).toBe('pendente');
  });
  it('número desconectado', () => {
    expect(fraseDoCampo({ ...base, desconectado: true, janelaFechada: true })).toBe(FRASE_DESCONECTADO);
  });
  it('janela de 24 h fechada', () => {
    expect(fraseDoCampo({ ...base, janelaFechada: true })).toBe(FRASE_JANELA_FECHADA);
  });
});
