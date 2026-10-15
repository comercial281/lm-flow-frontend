import { describe, expect, it } from 'vitest';
import type { PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS } from './enderecoDoQuadro';
import { colunasVisiveis, contarFiltros, opcoesDeOrigem, opcoesDeResponsavel } from './filtrosDoFunil';

describe('colunasVisiveis', () => {
  const etapas = [{ id: 's1', name: 'Novo' }, { id: 's2', name: 'Proposta' }] as unknown as PipelineStage[];
  it('sem escolha, todas; com escolha, só as escolhidas', () => {
    expect(colunasVisiveis(etapas, [])).toBe(etapas);
    expect(colunasVisiveis(etapas, ['s2']).map(s => s.id)).toEqual(['s2']);
  });
});

describe('filtros do funil', () => {
  it('conta um por grupo usado; motivo fora de Perdidos/Todos não conta', () => {
    expect(contarFiltros(FILTROS_VAZIOS, 'abertos')).toBe(0);
    expect(contarFiltros({ ...FILTROS_VAZIOS, de: '2026-10-01', ate: '2026-10-31', etapas: ['s1', 's2'], largados: 7 }, 'abertos')).toBe(3);
    expect(contarFiltros({ ...FILTROS_VAZIOS, tarefas: ['amanha'], categ: ['k1'] }, 'abertos')).toBe(2);
    expect(contarFiltros({ ...FILTROS_VAZIOS, motivos: ['m1'] }, 'abertos')).toBe(0);
    expect(contarFiltros({ ...FILTROS_VAZIOS, motivos: ['m1'] }, 'perdidos')).toBe(1);
  });
});

describe('opções do painel vêm do servidor', () => {
  it('origem: nome da origem, sem origem no fim', () => {
    expect(opcoesDeOrigem(['unknown', 'portal', 'portal']).map(o => o.valor)).toEqual(['portal', 'unknown']);
  });
  it('responsável: por nome, e "Sem responsável" quando há card sem dono', () => {
    expect(opcoesDeResponsavel({ origins: [], assignees: [{ id: 'u2', name: 'Bia' }, { id: 'u1', name: 'Ana' }], unassigned: true }))
      .toEqual([{ valor: 'u1', rotulo: 'Ana' }, { valor: 'u2', rotulo: 'Bia' }, { valor: 'nenhum', rotulo: 'Sem responsável' }]);
  });
});
