import { describe, it, expect } from 'vitest';
import { buildPagedRequest } from './filterConverters';
import type { ConversationFilter } from '@/types/chat/api';

// O "carregar mais" pedia só `{ page: N }`: a segunda página vinha SEM o
// filtro e era colada no fim da lista filtrada — quem filtrava pelo número do
// corretor rolava e via os leads de todo mundo (03/09/2026).
describe('buildPagedRequest', () => {
  const porInstancia: ConversationFilter[] = [
    { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: ['42'], query_operator: 'and' },
  ];

  it('leva o filtro de instância para a página seguinte (GET)', () => {
    const req = buildPagedRequest(porInstancia, 2);

    expect(req.kind).toBe('get');
    if (req.kind === 'get') {
      expect(req.params.inbox_id).toBe('42');
      expect(req.params.page).toBe(2);
    }
  });

  it('leva a busca junto', () => {
    const req = buildPagedRequest(porInstancia, 3, ' maria ');

    if (req.kind === 'get') {
      expect(req.params.q).toBe('maria');
      expect(req.params.inbox_id).toBe('42');
      expect(req.params.page).toBe(3);
    } else {
      throw new Error('esperava GET');
    }
  });

  it('usa o POST /filter, com a página, quando o filtro é avançado', () => {
    const avancado: ConversationFilter[] = [
      ...porInstancia,
      { attribute_key: 'created_at', filter_operator: 'is_greater_than', values: ['2026-09-01'], query_operator: 'and' },
    ];

    const req = buildPagedRequest(avancado, 2, 'joao');

    expect(req.kind).toBe('post');
    if (req.kind === 'post') {
      expect(req.body.page).toBe(2);
      expect(req.body.q).toBe('joao');
      expect(req.body.filters.map(f => f.attribute_key)).toEqual(['inbox_id', 'created_at']);
    }
  });

  it('sem filtro nem busca, é só a página', () => {
    expect(buildPagedRequest([], 4)).toEqual({ kind: 'get', params: { page: 4 } });
  });
});
