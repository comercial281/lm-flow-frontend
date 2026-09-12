import { describe, it, expect } from 'vitest';
import { connectedPagesFrom } from './connectedPages';
import type { MetaPage } from '@/services/integrations/metaPagesService';
import type { MetaForm } from '@/services/leadAds/leadAdsFormsService';

const page = (over: Partial<MetaPage>): MetaPage => ({
  id: 'uuid-a',
  page_id: '111',
  page_name: 'Imobiliária Centro',
  is_active: true,
  uses_own_token: false,
  has_token: true,
  webhook_subscribed: true,
  webhook_subscribed_at: null,
  connected_at: null,
  last_error: null,
  ...over,
});

const form = (over: Partial<MetaForm>): MetaForm => ({
  id: 'f1',
  name: 'Form',
  status: 'ACTIVE',
  leads_count: 0,
  ...over,
});

describe('connectedPagesFrom', () => {
  it('lista a página conectada mesmo sem nenhum formulário sincronizado', () => {
    // Era o defeito: a página B recém-conectada não aparecia no filtro, e
    // "não vejo nada" parecia "não está conectada".
    const result = connectedPagesFrom([page({ id: 'uuid-b', page_id: '222', page_name: 'Lançamentos' })], []);
    expect(result).toEqual([{ id: 'uuid-b', name: 'Lançamentos' }]);
  });

  it('deixa a página desativada de fora', () => {
    const result = connectedPagesFrom(
      [page({}), page({ id: 'uuid-b', page_id: '222', page_name: 'Parada', is_active: false })],
      [],
    );
    expect(result.map(p => p.id)).toEqual(['uuid-a']);
  });

  it('cai nas páginas dos formulários quando não há lista de páginas (cliente legado)', () => {
    const result = connectedPagesFrom(
      [],
      [
        form({ id: 'f1', meta_page_id: 'uuid-x', page_name: 'Da forma' }),
        form({ id: 'f2', meta_page_id: 'uuid-x', page_name: 'Da forma' }),
        form({ id: 'f3', meta_page_id: null }),
      ],
    );
    expect(result).toEqual([{ id: 'uuid-x', name: 'Da forma' }]);
  });

  it('não repete a página que está nas duas fontes, e o nome da lista manda', () => {
    const result = connectedPagesFrom(
      [page({ page_name: 'Nome oficial' })],
      [form({ meta_page_id: 'uuid-a', page_name: 'Nome velho' })],
    );
    expect(result).toEqual([{ id: 'uuid-a', name: 'Nome oficial' }]);
  });
});
