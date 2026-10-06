import { describe, expect, it } from 'vitest';
import { escondeBolinha } from './SupportWidget';

describe('bolinha de suporte', () => {
  it('some nas Conversas e no canvas do construtor (cobria o Salvar)', () => {
    expect(escondeBolinha('/conversations')).toBe(true);
    expect(escondeBolinha('/conversations/123')).toBe(true);
    expect(escondeBolinha('/automations/flow-builder/abc')).toBe(true);
    expect(escondeBolinha('/automations/follow-ups/abc')).toBe(true);
    expect(escondeBolinha('/automations/message-funnels/abc')).toBe(true);
  });

  it('some no cadastro de imóvel (cobria o Salvar)', () => {
    expect(escondeBolinha('/properties/new')).toBe(true);
    expect(escondeBolinha('/properties/42/editar')).toBe(true);
  });

  it('continua nas listas e nas outras telas', () => {
    expect(escondeBolinha('/automations/flow-builder')).toBe(false);
    expect(escondeBolinha('/automations/follow-ups')).toBe(false);
    expect(escondeBolinha('/automations/message-funnels')).toBe(false);
    expect(escondeBolinha('/conversations-old')).toBe(false);
    expect(escondeBolinha('/dashboard')).toBe(false);
    expect(escondeBolinha('/properties')).toBe(false);
    expect(escondeBolinha('/properties/map')).toBe(false);
  });
});
