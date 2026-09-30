import { describe, expect, it } from 'vitest';
import { passouPorTexto, resumoSorteioEmLote } from './exhaustedText';

describe('passouPorTexto', () => {
  it('resume a roleta inteira sem virar parágrafo', () => {
    const nomes = ['Ana', 'Bruno', 'Carla', 'Davi', 'Eva', 'Fábio', 'Gil', 'Hugo', 'Ivo', 'Jó'];
    expect(passouPorTexto(nomes)).toBe('Passou por 10 corretores: Ana, Bruno, Carla e mais 7');
  });

  it('não diz "e mais 0" quando cabe todo mundo', () => {
    expect(passouPorTexto(['Ana', 'Bruno'])).toBe('Passou por 2 corretores: Ana, Bruno');
  });

  it('singular com um corretor só', () => {
    expect(passouPorTexto(['Ana'])).toBe('Passou por 1 corretor: Ana');
  });

  it('some quando não há trilha', () => {
    expect(passouPorTexto([])).toBe('');
  });
});

describe('resumoSorteioEmLote', () => {
  it('tudo certo', () => {
    expect(resumoSorteioEmLote(3, 0)).toBe('3 leads sorteados de novo');
  });

  it('conta o que não saiu e diz onde está o motivo', () => {
    expect(resumoSorteioEmLote(1, 2)).toBe('1 lead sorteado de novo; 2 não saíram (o motivo está na linha de cada um)');
  });
});
