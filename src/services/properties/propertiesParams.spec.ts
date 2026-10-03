import { describe, it, expect } from 'vitest';
import api from '@/services/core/api';

// Rails lê `stage[]=a&stage[]=b` como array. Se o axios acrescentasse outro `[]`
// (`stage[][]=a`), o filtro chegaria quebrado ao servidor, sem erro nenhum.
describe('serialização dos filtros da lista de imóveis', () => {
  it('chave que já termina em [] com array vira stage[]=a&stage[]=b', () => {
    const uri = decodeURIComponent(
      api.getUri({ url: '/properties', params: { 'stage[]': ['a', 'b'], listing_kind: 'development' } }),
    );
    expect(uri).toContain('stage[]=a&stage[]=b');
    expect(uri).not.toContain('[][]');
    expect(uri).toContain('listing_kind=development');
  });
});
