import { describe, expect, it } from 'vitest';
import { iniciais, rotuloDoStatus, STATUS_DO_PROPRIETARIO } from './statusDoProprietario';

describe('statusDoProprietario', () => {
  it('quatro status na ordem da tela', () => {
    expect(STATUS_DO_PROPRIETARIO.map(s => s.rotulo)).toEqual(['Disponível', 'Com alteração', 'Indisponível', 'Sem resposta']);
    expect(rotuloDoStatus('no_response')).toBe('Sem resposta');
  });
  it('iniciais', () => {
    expect([iniciais('Maria da Silva Souza'), iniciais('ana'), iniciais('  ')]).toEqual(['MS', 'A', '?']);
  });
});
