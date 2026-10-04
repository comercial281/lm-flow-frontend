import { describe, it, expect } from 'vitest';
import { destinoDaAbaAntiga } from './adminEnderecosAntigos';

describe('abas antigas de Clientes', () => {
  it.each([
    ['leads-ao-vivo', '/admin/leads-ao-vivo'],
    ['numeros', '/admin/clientes/numeros'],
    ['logs', '/admin/usuarios/logs'],
    ['atividade', '/admin/usuarios/logs'],
    ['metrics', '/admin/usuarios'],
    ['archived-features', '/admin/plataforma/menus-arquivados'],
    ['sugestoes-bugs', '/admin/suporte'],
    ['dashboard', '/admin'],
    ['modo-cliente', '/admin/clientes'],
    ['formularios', '/admin/clientes'],
    ['inventada', '/admin/clientes'],
  ])('?tab=%s → %s', (tab, destino) => {
    expect(destinoDaAbaAntiga('/admin/clientes', tab)).toBe(destino);
  });

  it('sem aba, ou na aba Clientes, abre ali mesmo', () => {
    expect(destinoDaAbaAntiga('/admin/clientes', null)).toBeNull();
    expect(destinoDaAbaAntiga('/admin/clientes', 'clients')).toBeNull();
  });
});

describe('abas antigas da IA Vendedora', () => {
  it.each([
    ['cerebro', '/admin/agentes/conhecimento'],
    ['principios', '/admin/agentes/conhecimento'],
    ['aperfeicoamento', '/admin/agentes/conhecimento'],
    ['resultados', '/admin/agentes/dashboard'],
    ['inventada', '/admin/agentes'],
  ])('?tab=%s → %s', (tab, destino) => {
    expect(destinoDaAbaAntiga('/admin/agentes', tab)).toBe(destino);
  });

  it('sem aba, ou na aba Agentes, abre ali mesmo', () => {
    expect(destinoDaAbaAntiga('/admin/agentes', null)).toBeNull();
    expect(destinoDaAbaAntiga('/admin/agentes', 'agentes')).toBeNull();
  });
});

describe('abas com nome estranho', () => {
  it('nome herdado do JavaScript cai na tela-base, não vira função', () => {
    expect(destinoDaAbaAntiga('/admin/clientes', 'constructor')).toBe('/admin/clientes');
    expect(destinoDaAbaAntiga('/admin/agentes', 'toString')).toBe('/admin/agentes');
  });
});
