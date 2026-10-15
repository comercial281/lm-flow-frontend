import { describe, expect, it } from 'vitest';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS } from './enderecoDoQuadro';
import {
  TETO_DA_RECARGA, ajustarTotais, assinaturaDoQuadro, colunasParaReler, juntarSemRepetir,
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

describe('colunasParaReler', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`);
  it('só as colunas roladas além do 1º lote, cada uma até onde foi (teto 200)', () => {
    expect(colunasParaReler([etapa('s1', ids(30)), etapa('s2', ids(45)), etapa('s3', ['a']), etapa('s4', ids(450))]))
      .toEqual([{ stageId: 's2', limite: 45 }, { stageId: 's4', limite: TETO_DA_RECARGA }]);
    expect(colunasParaReler([etapa('s1', ids(30))])).toEqual([]);
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

  it('o valor da coluna acompanha o valor dos cards que saíram e entraram', () => {
    const comValor = (id: string, value: number) => ({ id, value }) as unknown as PipelineItem;
    const antes = [
      { ...etapa('s1', [], 40), items: [comValor('a', 1000), comValor('b', 500)], value_total: 90000 },
      { ...etapa('s2', [], 3), items: [], value_total: 2000 },
    ] as PipelineStage[];
    const depois = [{ ...antes[0], items: [antes[0].items![1]] }, { ...antes[1], items: [antes[0].items![0]] }];
    const mexido = ajustarTotais(antes, depois);
    expect(mexido.map(s => s.value_total)).toEqual([89000, 3000]);
    // O desfazer (que já traz os valores de antes) não é ajustado de novo.
    expect(ajustarTotais(mexido, antes).map(s => s.value_total)).toEqual([90000, 2000]);
  });

  it('sem valor do servidor não inventa valor', () => {
    const antes = [{ ...etapa('s1', [], 4), items: [({ id: 'a', value: 10 }) as unknown as PipelineItem] }] as PipelineStage[];
    expect(ajustarTotais(antes, [{ ...antes[0], items: [] }])[0].value_total).toBeUndefined();
  });

  it('sem total do servidor (servidor antigo) não inventa total', () => {
    const antes = [etapa('s1', ['a'])];
    expect(ajustarTotais(antes, [{ ...antes[0], items: [] }])[0].items_total).toBeUndefined();
  });

  it('quem não mudou nada recebe o mesmo array (a tela não se refaz à toa)', () => {
    const antes = [etapa('s1', ['a'], 40)];
    expect(ajustarTotais(antes, antes)).toBe(antes);
    const depois = [{ ...antes[0] }];
    expect(ajustarTotais(antes, depois)).toBe(depois);
  });
});

describe('juntarSemRepetir', () => {
  it('acrescenta só os que ainda não estão', () => {
    expect(juntarSemRepetir([item('a'), item('b')], [item('b'), item('c')]).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });
});
