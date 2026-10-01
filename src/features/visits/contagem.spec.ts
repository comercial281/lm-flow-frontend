// src/features/visits/contagem.spec.ts
import { describe, it, expect } from 'vitest';
import { intervaloDoMes, rotuloContador, lerContador } from './contagem';

describe('contagem da Agenda', () => {
  it('o intervalo do mês visível', () => {
    expect(intervaloDoMes(new Date(2026, 8, 15))).toEqual({ desde: '2026-09-01', ate: '2026-09-30' });
    expect(intervaloDoMes(new Date(2026, 1, 3))).toEqual({ desde: '2026-02-01', ate: '2026-02-28' });
  });

  it('o corretor lê que são as dele, no mês que está na tela', () => {
    expect(rotuloContador(7, { soMinhas: true, mes: new Date(2026, 8, 1) })).toBe('7 visitas suas em setembro');
    expect(rotuloContador(1, { soMinhas: true, mes: new Date(2026, 9, 1) })).toBe('1 visita sua em outubro');
  });

  it('o gestor lê o total, e sem mês quando a tela é a lista', () => {
    expect(rotuloContador(48, { soMinhas: false, mes: new Date(2026, 8, 1) })).toBe('48 visitas em setembro');
    expect(rotuloContador(3, { soMinhas: false })).toBe('3 visitas');
  });

  it('o mês inteiro do calendário conta sem as canceladas', () => {
    expect(lerContador({ total: 9, active_total: 7 }, { mesInteiro: true })).toEqual({ total: 7, servidorNovo: true });
  });

  it('lista, aba de situação ou filtro do link contam o que veio (a aba Canceladas não vira 0)', () => {
    expect(lerContador({ total: 4, active_total: 0 }, { mesInteiro: false })).toEqual({ total: 4, servidorNovo: true });
  });

  it('servidor antigo: total da história, e o rótulo fica sem mês', () => {
    const c = lerContador({ total: 415 }, { mesInteiro: true });
    expect(c).toEqual({ total: 415, servidorNovo: false });
    expect(rotuloContador(c.total, { soMinhas: false, mes: c.servidorNovo ? new Date(2026, 8, 1) : undefined }))
      .toBe('415 visitas');
  });

  it('sem meta, zero', () => {
    expect(lerContador(undefined, { mesInteiro: true })).toEqual({ total: 0, servidorNovo: false });
  });
});
