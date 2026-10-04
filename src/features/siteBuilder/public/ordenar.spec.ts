import { describe, it, expect } from 'vitest';
import type { PortalProperty } from './filtros';
import { ordenarImoveis } from './ordenar';

const p = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: 'apartment', ...o });
const codigos = (l: PortalProperty[]) => l.map(x => x.code);

const A = p('A', { created_at: '2026-09-01T10:00:00Z', sale_price_from: 500000, icon_summary: { useful_area_m2: 80 } });
const B = p('B', { created_at: '2026-10-01T10:00:00Z', sale_price_from: 300000, icon_summary: { useful_area_m2: 120 } });
const C = p('C', { created_at: '2026-08-01T10:00:00Z', sale_price_from: 900000, icon_summary: { useful_area_m2: 60 } });

describe('ordenarImoveis', () => {
  it('mais recentes', () => {
    expect(codigos(ordenarImoveis([A, B, C], 'recent', 'sale'))).toEqual(['B', 'A', 'C']);
  });
  it('menor preço', () => {
    expect(codigos(ordenarImoveis([A, B, C], 'price_asc', 'sale'))).toEqual(['B', 'A', 'C']);
  });
  it('maior preço', () => {
    expect(codigos(ordenarImoveis([A, B, C], 'price_desc', 'sale'))).toEqual(['C', 'A', 'B']);
  });
  it('maior área', () => {
    expect(codigos(ordenarImoveis([A, B, C], 'area_desc', 'sale'))).toEqual(['B', 'A', 'C']);
  });
  it('sem preço vai pro fim, nas duas direções, sem bagunçar os outros', () => {
    const semPreco = p('S', { created_at: '2026-10-02T00:00:00Z', sale_price_from: null });
    const zero = p('Z', { created_at: '2026-10-03T00:00:00Z', sale_price_from: 0 });
    expect(codigos(ordenarImoveis([semPreco, A, zero, B, C], 'price_asc', 'sale'))).toEqual(['B', 'A', 'C', 'Z', 'S']);
    expect(codigos(ordenarImoveis([semPreco, A, zero, B, C], 'price_desc', 'sale'))).toEqual(['C', 'A', 'B', 'Z', 'S']);
  });
  it('sem área (0.0 ou ausente) vai pro fim em maior área', () => {
    const zero = p('Z', { created_at: '2026-10-03T00:00:00Z', icon_summary: { useful_area_m2: 0 } });
    const nada = p('N', { created_at: '2026-10-02T00:00:00Z' });
    expect(codigos(ordenarImoveis([nada, A, zero, B, C], 'area_desc', 'sale'))).toEqual(['B', 'A', 'C', 'Z', 'N']);
  });
  it('empate desempata por mais recente e depois pelo código', () => {
    const x = p('X2', { created_at: '2026-09-01T00:00:00Z', sale_price_from: 100 });
    const y = p('X1', { created_at: '2026-09-01T00:00:00Z', sale_price_from: 100 });
    const z = p('X9', { created_at: '2026-09-05T00:00:00Z', sale_price_from: 100 });
    expect(codigos(ordenarImoveis([x, y, z], 'price_asc', 'sale'))).toEqual(['X9', 'X1', 'X2']);
    expect(codigos(ordenarImoveis([x, y, z], 'recent', 'sale'))).toEqual(['X9', 'X1', 'X2']);
  });
  it('código compara números como números (AP2 antes de AP10)', () => {
    const a = p('AP10', { sale_price_from: 1 }), b = p('AP2', { sale_price_from: 1 });
    expect(codigos(ordenarImoveis([a, b], 'price_asc', 'sale'))).toEqual(['AP2', 'AP10']);
  });
  it('aba Alugar usa o preço do aluguel', () => {
    const r1 = p('R1', { sale_price_from: 100, rent_price_from: 3000 });
    const r2 = p('R2', { sale_price_from: 900, rent_price_from: 1000 });
    expect(codigos(ordenarImoveis([r1, r2], 'price_asc', 'rent'))).toEqual(['R2', 'R1']);
    expect(codigos(ordenarImoveis([r1, r2], 'price_asc', 'sale'))).toEqual(['R1', 'R2']);
    expect(codigos(ordenarImoveis([r1, r2], 'price_asc', 'launch'))).toEqual(['R1', 'R2']);
  });
  it('servidor velho (sem data): mais recentes mantém a ordem que veio', () => {
    const l = [p('Z'), p('A'), p('M')];
    expect(codigos(ordenarImoveis(l, 'recent', 'sale'))).toEqual(['Z', 'A', 'M']);
  });
  it('não muda o array original', () => {
    const l = [A, B, C];
    const r = ordenarImoveis(l, 'price_desc', 'sale');
    expect(codigos(l)).toEqual(['A', 'B', 'C']);
    expect(r).not.toBe(l);
  });
});
