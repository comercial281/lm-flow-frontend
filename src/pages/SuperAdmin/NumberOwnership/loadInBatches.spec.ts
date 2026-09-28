import { describe, it, expect } from 'vitest';
import { loadInBatches } from './loadInBatches';

// O diagnóstico é de UM cliente por pedido (o servidor corta pedido longo em
// 15 s). A tela pede em lotes de 4: cliente que falha não pode travar os outros,
// e o clique em Atualizar não pode ser atropelado pela leitura anterior.
describe('loadInBatches', () => {
  it('pede no máximo 4 de cada vez e chega em todos', async () => {
    let inFlight = 0;
    let peak = 0;
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const seen: string[] = [];

    await loadInBatches(
      ids,
      4,
      async id => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        inFlight -= 1;
        return id.toUpperCase();
      },
      (id, result) => {
        if (result.ok) seen.push(`${id}:${result.value}`);
      },
    );

    expect(peak).toBe(4);
    expect(seen).toHaveLength(10);
    expect(seen).toContain('t9:T9');
  });

  it('um cliente que falha não impede os outros', async () => {
    const results: Record<string, boolean> = {};

    await loadInBatches(
      ['a', 'b', 'c'],
      4,
      async id => {
        if (id === 'b') throw new Error('500');
        return id;
      },
      (id, result) => {
        results[id] = result.ok;
      },
    );

    expect(results).toEqual({ a: true, b: false, c: true });
  });

  it('leitura que ficou velha (Atualizar no meio) para de pedir e não entrega nada', async () => {
    let stale = false;
    const started: string[] = [];
    const delivered: string[] = [];

    await loadInBatches(
      ['a', 'b', 'c', 'd', 'e'],
      2,
      async id => {
        started.push(id);
        if (id === 'b') stale = true;
        return id;
      },
      id => {
        delivered.push(id);
      },
      () => stale,
    );

    expect(started).toEqual(['a', 'b']);
    expect(delivered).toEqual([]);
  });
});
