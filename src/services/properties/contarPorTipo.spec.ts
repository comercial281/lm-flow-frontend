// src/services/properties/contarPorTipo.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { propertiesService } from './propertiesService';

const resposta = (data: unknown[], total: number) => ({ data: { data, meta: { total, page: 1, per_page: 1 } } });

type R = ReturnType<typeof resposta>;
function servidor(dev: R, rev: R, lei: R = resposta([], 0)) {
  return vi.spyOn(api, 'get').mockImplementation(async (_url: string, cfg?: { params?: { listing_kind?: string } }) => {
    const k = cfg?.params?.listing_kind;
    return (k === 'development' ? dev : k === 'auction' ? lei : rev) as never;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('propertiesService.contarPorTipo', () => {
  it('conta cada aba pelo total da lista, levando o recorte', async () => {
    const get = servidor(resposta([{ id: 'd', listing_kind: 'development' }], 12),
      resposta([{ id: 'r', listing_kind: 'resale' }], 38), resposta([{ id: 'l', listing_kind: 'auction' }], 5));
    expect(await propertiesService.contarPorTipo({ status: 'active' })).toEqual({ development: 12, resale: 38, auction: 5 });
    expect(get).toHaveBeenCalledWith('/properties', { params: { status: 'active', listing_kind: 'auction', per_page: 1 } });
  });

  it('servidor antigo (imóvel sem listing_kind): tudo é Revenda, as outras ficam 0', async () => {
    servidor(resposta([{ id: 'x' }], 40), resposta([{ id: 'x' }], 40), resposta([{ id: 'x' }], 40));
    expect(await propertiesService.contarPorTipo()).toEqual({ development: 0, resale: 40, auction: 0 });
  });

  it('servidor sem Leilão (ignora o filtro e devolve revenda): Leilão fica 0', async () => {
    servidor(resposta([{ id: 'd', listing_kind: 'development' }], 2), resposta([{ id: 'r', listing_kind: 'resale' }], 40),
      resposta([{ id: 'r', listing_kind: 'resale' }], 42));
    expect(await propertiesService.contarPorTipo()).toEqual({ development: 2, resale: 40, auction: 0 });
  });

  it('aba de empreendimentos vazia continua 0', async () => {
    servidor(resposta([], 0), resposta([{ id: 'r', listing_kind: 'resale' }], 3));
    expect(await propertiesService.contarPorTipo()).toEqual({ development: 0, resale: 3, auction: 0 });
  });
});
