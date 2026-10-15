import { describe, expect, it } from 'vitest';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS } from './enderecoDoQuadro';
import {
  POR_COLUNA, TETO_DA_RECARGA, ajustarTotais, assinaturaDoQuadro, juntarSemRepetir, limiteDaRecarga,
  paramsDoQuadro, semFiltroNaAberta,
} from './paramsDoQuadro';

const item = (id: string) => ({ id }) as unknown as PipelineItem;
const etapa = (id: string, itens: string[], total?: number) =>
  ({ id, name: id, items: itens.map(item), items_total: total }) as unknown as PipelineStage;

describe('paramsDoQuadro', () => {
  it('sem nada, só a aba', () => {
    expect(paramsDoQuadro('abertos', FILTROS_VAZIOS, '  ')).toEqual({ status: 'open' });
    expect(semFiltroNaAberta(paramsDoQuadro('abertos', FILTROS_VAZIOS, ''))).toBe(true);
    expect(semFiltroNaAberta(paramsDoQuadro('ganhos', FILTROS_VAZIOS, ''))).toBe(false);
  });

  it('leva busca e todos os filtros com os nomes que o servidor lê', () => {
    const p = paramsDoQuadro('perdidos', {
      de: '2026-10-01', ate: '2026-10-10', etapas: ['s1'], origens: ['portal'], resp: ['nenhum'], etiq: ['vip'],
      motivos: ['m1'], largados: 14, colunas: ['s1', 's2'], tarefas: ['atrasada'], categ: ['c1'],
    }, ' Maria ');
    expect(p).toEqual({
      status: 'lost', q: 'Maria', de: '2026-10-01', ate: '2026-10-10', largados: '14', etapas: ['s1'],
      colunas: ['s1', 's2'], origens: ['portal'], resp: ['nenhum'], etiq: ['vip'], tarefas: ['atrasada'],
      categ: ['c1'], motivos: ['m1'],
    });
  });

  it('motivo da perda só vai em Perdidos e Todos', () => {
    expect(paramsDoQuadro('abertos', { ...FILTROS_VAZIOS, motivos: ['m1'] }, '')).toEqual({ status: 'open' });
  });

  it('a assinatura não depende da ordem das chaves', () => {
    expect(assinaturaDoQuadro({ status: 'open', q: 'a' })).toBe(assinaturaDoQuadro({ q: 'a', status: 'open' }));
  });
});

describe('limiteDaRecarga', () => {
  it('relê até onde a pessoa rolou, entre 30 e 200', () => {
    expect(limiteDaRecarga([etapa('s1', ['a'])])).toBe(POR_COLUNA);
    expect(limiteDaRecarga([etapa('s1', Array.from({ length: 90 }, (_, i) => `i${i}`))])).toBe(90);
    expect(limiteDaRecarga([etapa('s1', Array.from({ length: 450 }, (_, i) => `i${i}`))])).toBe(TETO_DA_RECARGA);
  });
});

describe('ajustarTotais', () => {
  it('card que sai de uma coluna e entra em outra mexe nos dois totais', () => {
    const antes = [etapa('s1', ['a', 'b'], 40), etapa('s2', [], 3)];
    const depois = [{ ...antes[0], items: [item('b')] }, { ...antes[1], items: [item('a')] }];
    expect(ajustarTotais(antes, depois).map(s => s.items_total)).toEqual([39, 4]);
  });

  it('o desfazer do arraste (que já traz os totais de antes) não é ajustado de novo', () => {
    const antes = [etapa('s1', ['a', 'b'], 40), etapa('s2', [], 3)];
    const mexido = ajustarTotais(antes, [{ ...antes[0], items: [item('b')] }, { ...antes[1], items: [item('a')] }]);
    expect(ajustarTotais(mexido, antes).map(s => s.items_total)).toEqual([40, 3]);
  });

  it('sem total do servidor (servidor antigo) não inventa total', () => {
    const antes = [etapa('s1', ['a'])];
    expect(ajustarTotais(antes, [{ ...antes[0], items: [] }])[0].items_total).toBeUndefined();
  });
});

describe('juntarSemRepetir', () => {
  it('acrescenta só os que ainda não estão', () => {
    expect(juntarSemRepetir([item('a'), item('b')], [item('b'), item('c')]).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });
});
