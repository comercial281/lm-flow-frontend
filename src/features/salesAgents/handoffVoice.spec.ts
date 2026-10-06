import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fonteDaIaVendedora } from '../../test/fonteDaIaVendedora';

import { speaksAsBroker, toggleVoice } from './handoffVoice';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

// No WhatsApp de uma corretora, a IA dizia "vou passar pro meu colega do time".
// A chave faz ela falar como a própria corretora — e a escolha não pode sumir.
describe('handoffVoice', () => {
  it('é o padrão de sempre enquanto ninguém ligar', () => {
    expect(speaksAsBroker(undefined)).toBe(false);
    expect(speaksAsBroker(null)).toBe(false);
    expect(speaksAsBroker({ mode: 'duvida' })).toBe(false);
    expect(speaksAsBroker({ voice: 'first_person' })).toBe(true);
  });

  it('liga e desliga preservando o cenário e o resumo', () => {
    expect(toggleVoice({ mode: 'checklist', required_questions: ['Orçamento'], briefing_enabled: false }, true))
      .toEqual({ mode: 'checklist', required_questions: ['Orçamento'], briefing_enabled: false, voice: 'first_person' });
    // Desligar tira a chave: gravar o padrão congelaria a escolha de hoje.
    expect(toggleVoice({ mode: 'duvida', voice: 'first_person' }, false)).toEqual({ mode: 'duvida' });
  });

  // A voz é subchave do transfer_config (nunca campo solto). Desde a onda 3 ela
  // vem da persona (página Identidade), por `personaParaPatch`.
  it('a tela grava por dentro do transfer_config', () => {
    const tela = fonteDaIaVendedora();
    expect(read('src/features/salesAgents/tresEscolhas.ts')).toContain("toggleVoice(agent.transfer_config, persona === 'broker')");
    expect(tela).not.toMatch(/\bvoice:\s*['"]first_person['"]/);
  });
});
