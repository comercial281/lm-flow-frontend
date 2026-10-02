import { describe, expect, it } from 'vitest';
import { FILTROS_VAZIOS, SEM_RESPONSAVEL, linhasDoFiltro, quantosFiltros } from './filtros';

describe('Filtros de Contatos', () => {
  it('sem nada escolhido não manda linha nenhuma', () => {
    expect(linhasDoFiltro(FILTROS_VAZIOS, 'todos', 'eu')).toEqual([]);
  });

  it('"Meus" filtra pelo id de quem está logado', () => {
    expect(linhasDoFiltro(FILTROS_VAZIOS, 'meus', 'u1')).toEqual([
      expect.objectContaining({ attributeKey: 'default_assignee_id', filterOperator: 'equal_to', values: 'u1' }),
    ]);
  });

  it('"Sem responsável" pede o campo vazio', () => {
    expect(linhasDoFiltro(FILTROS_VAZIOS, 'sem_responsavel')).toEqual([
      expect.objectContaining({ attributeKey: 'default_assignee_id', filterOperator: 'is_not_present' }),
    ]);
  });

  it('a pílula substitui o responsável escolhido no popover', () => {
    const linhas = linhasDoFiltro({ ...FILTROS_VAZIOS, responsavel: 'u2' }, 'meus', 'u1');
    expect(linhas.filter(l => l.attributeKey === 'default_assignee_id')).toHaveLength(1);
    expect(linhas[0].values).toBe('u1');
  });

  it('em "Todos", vale o responsável do popover (inclusive sem responsável)', () => {
    expect(linhasDoFiltro({ ...FILTROS_VAZIOS, responsavel: SEM_RESPONSAVEL }, 'todos')[0].filterOperator).toBe(
      'is_not_present',
    );
  });

  it('com e sem etiqueta convivem, e a exclusão leva a lista inteira', () => {
    const linhas = linhasDoFiltro({ comEtiqueta: 'vip', semEtiquetas: ['bolsao', 'teste'], responsavel: '' }, 'todos');
    expect(linhas).toEqual([
      expect.objectContaining({ attributeKey: 'labels', filterOperator: 'equal_to', values: 'vip' }),
      expect.objectContaining({ attributeKey: 'labels', filterOperator: 'not_equal_to', values: ['bolsao', 'teste'] }),
    ]);
  });

  it('o número do botão conta filtros, não etiquetas', () => {
    expect(quantosFiltros({ comEtiqueta: 'vip', semEtiquetas: ['a', 'b'], responsavel: 'u1' })).toBe(3);
  });
});
