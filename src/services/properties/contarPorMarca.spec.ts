import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { propertiesService } from './propertiesService';

const total = (n: number) => ({ data: { data: [], meta: { total: n, page: 1, per_page: 1 } } });

type Params = { status?: string; listing_kind?: string; 'transaction_type[]'?: string[]; per_page?: number };

function servidor(porMarca: { venda: number; locacao: number; leilao: number; empreendimento: number }) {
  return vi.spyOn(api, 'get').mockImplementation(async (_url: string, cfg?: { params?: Params }) => {
    const p = cfg?.params ?? {};
    if (p.listing_kind === 'auction') return total(porMarca.leilao) as never;
    if (p.listing_kind === 'development') return total(porMarca.empreendimento) as never;
    if (p['transaction_type[]']?.includes('rent')) return total(porMarca.locacao) as never;
    return total(porMarca.venda) as never;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('propertiesService.contarPorMarca', () => {
  it('faz 4 pedidos, de ativos e reservados (como o servidor), e devolve a contagem de cada marca', async () => {
    const get = servidor({ venda: 30, locacao: 8, leilao: 2, empreendimento: 5 });
    expect(await propertiesService.contarPorMarca()).toEqual({ venda: 30, locacao: 8, leilao: 2, empreendimento: 5 });
    expect(get).toHaveBeenCalledTimes(4);
    for (const call of get.mock.calls) {
      expect((call[1] as { params: Params }).params).toMatchObject({ 'status[]': ['active', 'reserved'], per_page: 1 });
    }
  });

  it('cada marca leva o seu recorte (venda = revenda à venda; locação = aluguel; leilão e empreendimento pelo tipo)', async () => {
    const get = servidor({ venda: 1, locacao: 1, leilao: 1, empreendimento: 1 });
    await propertiesService.contarPorMarca();
    const params = get.mock.calls.map((c) => (c[1] as { params: Params }).params);
    expect(params).toContainEqual({ 'status[]': ['active', 'reserved'], per_page: 1, listing_kind: 'resale', 'transaction_type[]': ['sale', 'sale_rent'] });
    expect(params).toContainEqual({ 'status[]': ['active', 'reserved'], per_page: 1, 'transaction_type[]': ['rent', 'sale_rent'] });
    expect(params).toContainEqual({ 'status[]': ['active', 'reserved'], per_page: 1, listing_kind: 'auction' });
    expect(params).toContainEqual({ 'status[]': ['active', 'reserved'], per_page: 1, listing_kind: 'development' });
  });

  it('marca sem imóvel fica 0', async () => {
    servidor({ venda: 0, locacao: 0, leilao: 0, empreendimento: 0 });
    expect(await propertiesService.contarPorMarca()).toEqual({ venda: 0, locacao: 0, leilao: 0, empreendimento: 0 });
  });
});
