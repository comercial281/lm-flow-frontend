import { describe, it, expect } from 'vitest';
import { moveMember, queueOrdinal } from './roletaQueueOrder';

describe('moveMember (ordem da Fila)', () => {
  it('sobe e desce uma casa', () => {
    expect(moveMember(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveMember(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('nos limites devolve a mesma lista', () => {
    const lista = ['a', 'b'];
    expect(moveMember(lista, 0, -1)).toBe(lista);
    expect(moveMember(lista, 1, 1)).toBe(lista);
    expect(moveMember(lista, 5, -1)).toBe(lista);
  });

  it('não muta a lista original', () => {
    const lista = ['a', 'b'];
    moveMember(lista, 0, 1);
    expect(lista).toEqual(['a', 'b']);
  });
});

describe('queueOrdinal', () => {
  it('numera a partir de 1', () => {
    expect(queueOrdinal(0)).toBe('1º');
    expect(queueOrdinal(2)).toBe('3º');
  });
});
