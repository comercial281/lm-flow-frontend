import { describe, it, expect } from 'vitest';
import { rotuloDoTipo } from './tipoDaVisita';

describe('rotuloDoTipo', () => {
  it('os quatro tipos, com os mesmos nomes do aviso do servidor', () => {
    expect(rotuloDoTipo({ kind: 'visita' })).toBe('Visita');
    expect(rotuloDoTipo({ kind: 'videochamada' })).toBe('Videochamada');
    expect(rotuloDoTipo({ kind: 'reuniao' })).toBe('Reunião');
    expect(rotuloDoTipo({ kind: 'ligacao' })).toBe('Ligação');
  });

  it('sem tipo (servidor antigo ou visita de antes) e tipo desconhecido valem Visita', () => {
    expect(rotuloDoTipo({})).toBe('Visita');
    expect(rotuloDoTipo({ kind: null })).toBe('Visita');
    expect(rotuloDoTipo({ kind: 'outra' })).toBe('Visita');
  });
});
