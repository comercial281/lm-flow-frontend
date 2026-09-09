import { describe, it, expect } from 'vitest';
import {
  buildLandingSettings,
  readDisqualifiedBranch,
  readRoletaConfigId,
} from './landingRouting';

describe('roteamento da landing', () => {
  const semRamo = { disqualified: null, roletaConfigId: null };

  describe('o que já estava gravado atravessa', () => {
    // O defeito que isto fecha: o destino escolhido dentro de cada pergunta do
    // formulário é gravado pelo EDITOR da landing, no mesmo lugar. Montando o
    // bloco do zero, abrir a janela de destino e salvar apagava tudo, calado.
    it('preserva o destino escolhido dentro das perguntas', () => {
      const stored = {
        routing: {
          by_answer: { 'op-alto': { pipeline_id: 'funil-vip', stage_id: 'coluna-1' } },
        },
      };

      const out = buildLandingSettings(stored, semRamo, { mode: 'off' });

      expect((out.routing as Record<string, unknown>).by_answer).toEqual({
        'op-alto': { pipeline_id: 'funil-vip', stage_id: 'coluna-1' },
      });
    });

    it('preserva chaves de fora do roteamento', () => {
      const out = buildLandingSettings({ thank_you: { titulo: 'Obrigado!' } }, semRamo, { mode: 'off' });

      expect(out.thank_you).toEqual({ titulo: 'Obrigado!' });
    });

    it('aguenta landing sem nada gravado', () => {
      expect(() => buildLandingSettings(null, semRamo, { mode: 'off' })).not.toThrow();
      expect(buildLandingSettings(undefined, semRamo, { mode: 'off' }).routing).toEqual({
        disqualified: {},
        roleta_config_id: null,
      });
    });
  });

  describe('quem assume o lead', () => {
    it('grava a roleta escolhida', () => {
      const out = buildLandingSettings({}, { disqualified: null, roletaConfigId: 'rol-1' }, {});

      expect(readRoletaConfigId(out)).toBe('rol-1');
    });

    // Vazio é escolha: o lead entra sem responsável e a gestão distribui na mão.
    it('grava nulo quando ninguém foi escolhido, apagando a roleta anterior', () => {
      const out = buildLandingSettings({ routing: { roleta_config_id: 'rol-antiga' } }, semRamo, {});

      expect((out.routing as Record<string, unknown>).roleta_config_id).toBeNull();
      expect(readRoletaConfigId(out)).toBe('');
    });

    it('landing sem roleta lê vazio', () => {
      expect(readRoletaConfigId({})).toBe('');
      expect(readRoletaConfigId(null)).toBe('');
      expect(readRoletaConfigId({ routing: 'torto' })).toBe('');
    });
  });

  describe('ramo do desqualificado', () => {
    it('grava os três campos quando algum foi preenchido', () => {
      const out = buildLandingSettings(
        {},
        { disqualified: { pipeline_id: 'f2', stage_id: null, label_id: null }, roletaConfigId: null },
        {},
      );

      expect(readDisqualifiedBranch(out)).toEqual({ pipeline_id: 'f2', stage_id: null, label_id: null });
    });

    it('vazio significa "usa o roteamento padrão"', () => {
      const out = buildLandingSettings({ routing: { disqualified: { pipeline_id: 'f2' } } }, semRamo, {});

      expect(readDisqualifiedBranch(out)).toEqual({});
    });
  });

  it('o pixel vai como veio', () => {
    const out = buildLandingSettings({}, semRamo, { mode: 'crm', submitEvent: 'Lead' });

    expect(out.pixel).toEqual({ mode: 'crm', submitEvent: 'Lead' });
  });
});
