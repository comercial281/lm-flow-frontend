import { describe, expect, it } from 'vitest';
import { rotaComAba } from './SupportWidget';

describe('onde a bolinha de suporte vira aba', () => {
  it('vira aba em Conversas e no canvas do construtor (cobria o Salvar)', () => {
    expect(rotaComAba('/conversations')).toBe(true);
    expect(rotaComAba('/conversations/123')).toBe(true);
    expect(rotaComAba('/automations/flow-builder/abc')).toBe(true);
    expect(rotaComAba('/automations/follow-ups/abc')).toBe(true);
    expect(rotaComAba('/automations/message-funnels/abc')).toBe(true);
  });

  it('vira aba no cadastro de imóvel (cobria o Salvar)', () => {
    expect(rotaComAba('/properties/new')).toBe(true);
    expect(rotaComAba('/properties/42/editar')).toBe(true);
  });

  it('continua bolinha nas outras telas', () => {
    expect(rotaComAba('/automations/flow-builder')).toBe(false);
    expect(rotaComAba('/automations/follow-ups')).toBe(false);
    expect(rotaComAba('/automations/message-funnels')).toBe(false);
    expect(rotaComAba('/conversations-old')).toBe(false);
    expect(rotaComAba('/dashboard')).toBe(false);
    expect(rotaComAba('/properties')).toBe(false);
    expect(rotaComAba('/properties/map')).toBe(false);
  });
});
