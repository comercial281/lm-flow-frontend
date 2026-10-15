import { describe, it, expect } from 'vitest';
import type { PipelineItem } from '@/types/analytics';
import { indiceDoArraste } from './ondeOCardCai';

const itens = ['a', 'b', 'c'].map(id => ({ id }) as PipelineItem);
const base = { itens, colunaDeGanho: false };

describe('indiceDoArraste', () => {
  it('em cima de um card de outra coluna: metade de cima entra antes, de baixo entra depois', () => {
    const outra = { ...base, arrastadoId: 'x', mesmaColuna: false };
    expect(indiceDoArraste({ ...outra, sobre: { id: 'b', metade: 'above' } })).toBe(1);
    expect(indiceDoArraste({ ...outra, sobre: { id: 'b', metade: 'below' } })).toBe(2);
  });

  it('espaço vazio de outra coluna: topo', () => {
    expect(indiceDoArraste({ ...base, arrastadoId: 'x', mesmaColuna: false })).toBe(0);
    expect(indiceDoArraste({ itens: [], colunaDeGanho: false, arrastadoId: 'x', mesmaColuna: false })).toBe(0);
  });

  it('espaço vazio da mesma coluna: fundo', () => {
    expect(indiceDoArraste({ ...base, arrastadoId: 'a', mesmaColuna: true })).toBe(2);
  });

  it('soltar onde não muda nada devolve null', () => {
    const mesma = { ...base, mesmaColuna: true };
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'b', sobre: { id: 'b', metade: 'above' } })).toBeNull();
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'b', sobre: { id: 'a', metade: 'below' } })).toBeNull();
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'b', sobre: { id: 'c', metade: 'above' } })).toBeNull();
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'c' })).toBeNull();
    expect(indiceDoArraste({ itens: [{ id: 'a' } as PipelineItem], colunaDeGanho: false, arrastadoId: 'a', mesmaColuna: true })).toBeNull();
  });

  it('mesma coluna: reordena pra cima e pra baixo', () => {
    const mesma = { ...base, mesmaColuna: true };
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'c', sobre: { id: 'a', metade: 'above' } })).toBe(0);
    expect(indiceDoArraste({ ...mesma, arrastadoId: 'a', sobre: { id: 'c', metade: 'below' } })).toBe(2);
  });

  it('Concluído de outra coluna: sempre o topo, como o ganhar', () => {
    expect(indiceDoArraste({ ...base, colunaDeGanho: true, arrastadoId: 'x', mesmaColuna: false, sobre: { id: 'c', metade: 'below' } })).toBe(0);
  });
});
