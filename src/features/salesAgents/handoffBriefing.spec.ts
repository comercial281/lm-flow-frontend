import { describe, it, expect } from 'vitest';
import { fonteDaIaVendedora } from '../../test/fonteDaIaVendedora';

import { briefingEnabled, toggleBriefing } from './handoffBriefing';

// O resumo do que a IA descobriu viajando junto com o lead no repasse. Ele estreia
// LIGADO em todas as imobiliárias, e a chave existe só para desligar.
describe('handoffBriefing', () => {
  // Agente que nunca viu a chave é todo agente que existe hoje. Lido com `=== true`,
  // a tela mostraria desligado e o gestor "ligaria" o que já estava valendo.
  it('está ligado enquanto ninguém desligar', () => {
    expect(briefingEnabled(undefined)).toBe(true);
    expect(briefingEnabled(null)).toBe(true);
    expect(briefingEnabled({})).toBe(true);
    expect(briefingEnabled({ mode: 'checklist' })).toBe(true);
  });

  it('desliga só com false explícito', () => {
    expect(briefingEnabled({ briefing_enabled: false })).toBe(false);
  });

  // Ligar REMOVE a chave em vez de gravar true: gravar o padrão congelaria a escolha
  // de hoje se o padrão da casa mudasse. Mesma regra do texto de fábrica do portal.
  it('ligar tira a chave; desligar grava false e preserva o cenário', () => {
    expect(toggleBriefing({ briefing_enabled: false, mode: 'temperatura', min_temperature: 'warm' }, true))
      .toEqual({ mode: 'temperatura', min_temperature: 'warm' });

    expect(toggleBriefing({ mode: 'checklist', required_questions: ['Orçamento'] }, false))
      .toEqual({ mode: 'checklist', required_questions: ['Orçamento'], briefing_enabled: false });
  });

  // A tela monta o PATCH campo a campo: campo solto do agente é descartado em
  // silêncio, com o aviso dizendo "Salvo".
  describe('a tela', () => {
    const tela = fonteDaIaVendedora();

    it('grava a chave por dentro do transfer_config, nunca como campo solto', () => {
      expect(tela).toContain('toggleBriefing(cfg, v)');
      expect(tela).not.toMatch(/briefing_enabled:\s*(true|false|v)\b/);
    });
  });
});
