import { describe, expect, it } from 'vitest';
import { FILTROS_DO_PORTAL_VAZIOS as V, corretoresDaLista, filtrarImoveisDoPortal, temFiltro } from './filtrosDoSeletor';

const im = (id: string, extra: Record<string, unknown> = {}) => ({
  id, code: `AP${id}`, title: `Imóvel ${id}`, address_neighborhood: 'Lapa', address_city: 'São Paulo', ...extra,
}) as Parameters<typeof filtrarImoveisDoPortal>[0][number];

describe('filtros da lista do portal', () => {
  const leo = { id: 'leo', name: 'Leonardo' };
  const ivan = { id: 'ivan', name: 'Ivan' };
  const lista = [im('1', { captor: leo }), im('2', { captor: ivan, responsible: leo }), im('3', { stale_due_on: '2026-11-01' })];
  const pubs = new Map([['1', 'standard'], ['3', 'premium']]);
  const ids = (f: Partial<typeof V>) => filtrarImoveisDoPortal(lista, pubs, { ...V, ...f }, '2026-11-10').map(p => p.id);

  it('corretor casa captador ou responsável', () => {
    expect(ids({ corretor: 'leo' })).toEqual(['1', '2']);
    expect(ids({ corretor: 'ivan' })).toEqual(['2']);
  });
  it('tipo de anúncio só pega quem está marcado nele', () => {
    expect(ids({ tipo: 'premium' })).toEqual(['3']);
  });
  it('desatualizados pelo prazo do imóvel', () => {
    expect(ids({ desatualizados: true })).toEqual(['3']);
  });
  it('busca acha pela referência', () => {
    expect(ids({ busca: 'ap2' })).toEqual(['2']);
  });
  it('combina com No portal / Fora', () => {
    expect(ids({ mostrar: 'fora', corretor: 'leo' })).toEqual(['2']);
  });
  it('temFiltro e lista de corretores sem repetir', () => {
    expect(temFiltro(V)).toBe(false);
    expect(temFiltro({ ...V, corretor: 'leo' })).toBe(true);
    expect(corretoresDaLista(lista)).toEqual([ivan, leo]);
  });
});
