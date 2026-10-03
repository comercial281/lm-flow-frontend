// src/services/properties/contarPorTipo.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { propertiesService } from './propertiesService';

const resposta = (data: unknown[], total: number) => ({ data: { data, meta: { total, page: 1, per_page: 1 } } });

function servidor(dev: ReturnType<typeof resposta>, rev: ReturnType<typeof resposta>) {
  return vi.spyOn(api, 'get').mockImplementation(async (_url: string, cfg?: { params?: { listing_kind?: string } }) =>
    (cfg?.params?.listing_kind === 'development' ? dev : rev) as never);
}

afterEach(() => vi.restoreAllMocks());

describe('propertiesService.contarPorTipo', () => {
  it('conta cada aba pelo total da lista, levando o recorte', async () => {
    const get = servidor(resposta([{ id: 'd', listing_kind: 'development' }], 12), resposta([{ id: 'r', listing_kind: 'resale' }], 38));
    expect(await propertiesService.contarPorTipo({ status: 'active' })).toEqual({ development: 12, resale: 38 });
    expect(get).toHaveBeenCalledWith('/properties', { params: { status: 'active', listing_kind: 'development', per_page: 1 } });
  });

  it('servidor antigo (imóvel sem listing_kind): tudo é Revenda, Empreendimentos fica 0', async () => {
    servidor(resposta([{ id: 'x' }], 40), resposta([{ id: 'x' }], 40));
    expect(await propertiesService.contarPorTipo()).toEqual({ development: 0, resale: 40 });
  });

  it('aba de empreendimentos vazia continua 0', async () => {
    servidor(resposta([], 0), resposta([{ id: 'r', listing_kind: 'resale' }], 3));
    expect(await propertiesService.contarPorTipo()).toEqual({ development: 0, resale: 3 });
  });
});
