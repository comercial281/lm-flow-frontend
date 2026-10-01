// src/pages/Customer/DashboardNova/catalogo.spec.ts
import { describe, it, expect } from 'vitest';
import { BLOCOS_API, BLOCOS_FUNIL, CATALOGO, linhasDaVisao } from './catalogo';
import { gestorVendoComoCorretor, visaoDoEscopo } from './visao';

const ids = (visao: 'gestor' | 'corretor') => linhasDaVisao(visao).flatMap(l => l.colunas.flat());

describe('catálogo da Dashboard', () => {
  it('o gestor vê, nesta ordem, imóveis, números, pendências… e a análise no fim', () => {
    expect(ids('gestor')).toEqual([
      'imoveis', 'numeros', 'pendencias',
      'proximas_visitas', 'roleta_agora',
      'atendimento_time', 'funil',
      'resultados',
      'leads_dia_semana', 'leads_horario', 'leads_seis_meses', 'origem',
    ]);
  });

  it('o corretor abre pelas pendências e não vê resultados, time nem roleta', () => {
    const corretor = ids('corretor');
    expect(corretor[0]).toBe('pendencias');
    expect(corretor).not.toContain('resultados');
    expect(corretor).not.toContain('atendimento_time');
    expect(corretor).not.toContain('roleta_agora');
  });

  it('o mapa de calor existe no catálogo, desligado, e não é pedido à API', () => {
    expect(CATALOGO.mapa_calor.ligado).toBe(false);
    expect(ids('gestor')).not.toContain('mapa_calor');
    expect(BLOCOS_API).not.toContain('heatmap');
  });

  it('pede à API tudo que alguma visão desenha, e nada que nenhum bloco lê', () => {
    expect(BLOCOS_API).toEqual(expect.arrayContaining(['kpis', 'properties', 'pending', 'upcoming', 'team', 'results']));
    // O tempo de resposta geral não aparece em bloco nenhum (o do time vem em `team`).
    expect(BLOCOS_API).not.toContain('response');
  });

  it('o funil vem num pedido à parte: trocar de funil não refaz o resto', () => {
    expect(BLOCOS_API).not.toContain('pipeline');
    expect(BLOCOS_FUNIL).toEqual(['pipeline']);
  });

  it('visão pelo recorte que o servidor resolveu', () => {
    const escopo = (mode: 'mine' | 'team' | 'all', locked = false) =>
      ({ mode, locked, available_modes: [mode], blocks: { media_spend: false, operations: false } });
    expect(visaoDoEscopo(escopo('all'))).toBe('gestor');
    expect(visaoDoEscopo(escopo('team'))).toBe('gestor');
    expect(visaoDoEscopo(escopo('mine', true))).toBe('corretor');
    expect(gestorVendoComoCorretor(escopo('mine', false), true)).toBe(true);
    expect(gestorVendoComoCorretor(escopo('mine', true), true)).toBe(false);
    // Corretor de verdade num cliente com o isolamento desligado: destravado, mas não é gestor.
    expect(gestorVendoComoCorretor(escopo('mine', false), false)).toBe(false);
    expect(gestorVendoComoCorretor(escopo('all', false), true)).toBe(false);
    expect(visaoDoEscopo(undefined)).toBe('gestor');
  });
});
