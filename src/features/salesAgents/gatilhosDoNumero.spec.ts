import { describe, expect, it } from 'vitest';
import { estadoDosGatilhos, gatilhosDoEstado } from './gatilhosDoNumero';

const forma = { type: 'form' as const, form_ids: ['111'] };

describe('estadoDosGatilhos', () => {
  it('nulo herda os do agente', () => {
    expect(estadoDosGatilhos({ triggers: null })).toBe('do_agente');
  });
  it('lista vazia é todo lead do número (não é o mesmo que herdar)', () => {
    expect(estadoDosGatilhos({ triggers: [] })).toBe('todo_lead');
  });
  it('lista com gatilho é "só alguns"', () => {
    expect(estadoDosGatilhos({ triggers: [forma] })).toBe('proprios');
  });
});

describe('gatilhosDoEstado', () => {
  it('voltar pra "Os do agente" grava nulo, nunca lista vazia', () => {
    const r = gatilhosDoEstado('do_agente', [forma]);
    expect(r).toBeNull();
    expect(r).not.toEqual([]);
    expect(gatilhosDoEstado('do_agente', [])).toBeNull();
  });
  it('"Todo lead do número" grava lista vazia, nunca nulo', () => {
    const r = gatilhosDoEstado('todo_lead', [forma]);
    expect(r).toEqual([]);
    expect(gatilhosDoEstado('todo_lead', null)).toEqual([]);
  });
  it('"Só alguns" mantém os gatilhos que o número já tem; sem nenhum, não há o que gravar (lista vazia)', () => {
    expect(gatilhosDoEstado('proprios', [forma])).toEqual([forma]);
    expect(gatilhosDoEstado('proprios', null)).toEqual([]);
  });
});
