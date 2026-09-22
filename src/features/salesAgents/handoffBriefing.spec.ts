import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { briefingEnabled, keepBriefing, toggleBriefing } from './handoffBriefing';

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

  // ⚠️ Trocar de cenário SUBSTITUI o transfer_config inteiro. Sem isto o gestor
  // desligava o resumo, trocava o cenário depois, e o resumo voltava a sair sem
  // ninguém ver.
  describe('a escolha sobrevive à troca de cenário', () => {
    it('carrega o false para o cenário novo', () => {
      expect(keepBriefing({ briefing_enabled: false, mode: 'temperatura' }, { mode: 'duvida' }))
        .toEqual({ mode: 'duvida', briefing_enabled: false });
    });

    it('não inventa a chave quando ninguém desligou', () => {
      expect(keepBriefing({ mode: 'temperatura' }, { mode: 'duvida' })).toEqual({ mode: 'duvida' });
      expect(keepBriefing(undefined, {})).toEqual({});
    });

    // O que a limpeza de cenário existe para fazer continua acontecendo: a
    // temperatura mínima e as obrigatórias não podem ficar penduradas.
    it('não carrega o campo do cenário anterior', () => {
      const proximo = keepBriefing(
        { briefing_enabled: false, mode: 'temperatura', min_temperature: 'warm' },
        { mode: 'checklist', required_questions: [] },
      );
      expect(proximo.min_temperature).toBeUndefined();
    });
  });

  // A tela monta o PATCH campo a campo: campo solto do agente é descartado em
  // silêncio, com o aviso dizendo "Salvo".
  describe('a tela', () => {
    const tela = readFileSync('src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx', 'utf-8');

    it('grava a chave por dentro do transfer_config, nunca como campo solto', () => {
      expect(tela).toContain('toggleBriefing(cfg, v)');
      expect(tela).not.toMatch(/briefing_enabled:\s*(true|false|v)\b/);
    });

    // Cada escrita do cenário passa por keepBriefing. Uma esquecida apaga a escolha
    // do gestor naquele caminho, e só naquele — o pior tipo de defeito: intermitente.
    it('preserva a escolha em TODA escrita do cenário', () => {
      const escritas = tela.split('\n').filter((l) => l.includes('transfer_config:'));
      const doCenario = escritas.filter((l) => l.includes('mode:') || l.includes('transfer_config: keepBriefing'));
      expect(doCenario.length).toBeGreaterThanOrEqual(4);
      doCenario.forEach((linha) => expect(linha).toContain('keepBriefing'));
    });
  });
});
