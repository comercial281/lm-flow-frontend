import { describe, it, expect } from 'vitest';
import { ROTEIRO, PERGUNTAS, type PassoId } from './roteiro';

// O roteiro é dado editado à mão. Estas travas garantem que nenhuma edição
// deixa o cliente num beco: toda opção leva a algum lugar, todo passo é
// alcançável e todo fim de resposta pergunta "Isso resolveu?".
const ids = Object.keys(ROTEIRO) as PassoId[];

describe('roteiro do suporte', () => {
  it('toda opção "vai" aponta para passo que existe', () => {
    for (const id of ids) {
      for (const op of ROTEIRO[id].opcoes) {
        if ('vai' in op.acao) expect(ids, `${id} → ${op.acao.vai}`).toContain(op.acao.vai);
      }
    }
  });

  it('todo passo é alcançável a partir das perguntas do Início', () => {
    const visto = new Set<PassoId>();
    const fila = [...PERGUNTAS];
    while (fila.length) {
      const id = fila.shift()!;
      if (visto.has(id)) continue;
      visto.add(id);
      for (const op of ROTEIRO[id].opcoes) if ('vai' in op.acao) fila.push(op.acao.vai);
    }
    expect([...visto].sort()).toEqual([...ids].sort());
  });

  it('passo sem continuação termina em "Isso resolveu?" com Sim e Não', () => {
    for (const id of ids) {
      const passo = ROTEIRO[id];
      if (passo.opcoes.some(op => 'vai' in op.acao)) continue;
      expect(passo.texto.at(-1), id).toBe('Isso resolveu?');
      expect(passo.opcoes.map(o => o.rotulo), id).toEqual(expect.arrayContaining(['Sim, resolveu', 'Não, falar com o time']));
    }
  });

  it('link do Guia aponta para o Guia do LM Flow', () => {
    for (const id of ids) {
      for (const op of ROTEIRO[id].opcoes) {
        if ('guia' in op.acao) expect(op.acao.guia.startsWith('/tutorials'), id).toBe(true);
      }
    }
  });

  it('as perguntas do Início têm texto de pergunta', () => {
    expect(PERGUNTAS.length).toBeGreaterThanOrEqual(8);
    for (const id of PERGUNTAS) expect(ROTEIRO[id].pergunta, id).toBeTruthy();
  });
});
