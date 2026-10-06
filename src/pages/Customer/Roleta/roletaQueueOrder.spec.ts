import { describe, it, expect } from 'vitest';
import { moveMember } from './roletaQueueOrder';

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
