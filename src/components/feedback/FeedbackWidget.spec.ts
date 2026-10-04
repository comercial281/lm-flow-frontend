import { describe, expect, it } from 'vitest';
import { hidesFloatingFeedback } from './FeedbackWidget';

describe('botão flutuante de Sugestões/Bugs', () => {
  it('some nas Conversas e no canvas do construtor (cobria o Salvar)', () => {
    expect(hidesFloatingFeedback('/conversations')).toBe(true);
    expect(hidesFloatingFeedback('/conversations/123')).toBe(true);
    expect(hidesFloatingFeedback('/automations/flow-builder/abc')).toBe(true);
    expect(hidesFloatingFeedback('/automations/follow-ups/abc')).toBe(true);
    expect(hidesFloatingFeedback('/automations/message-funnels/abc')).toBe(true);
  });

  it('continua nas listas e nas outras telas', () => {
    expect(hidesFloatingFeedback('/automations/flow-builder')).toBe(false);
    expect(hidesFloatingFeedback('/automations/follow-ups')).toBe(false);
    expect(hidesFloatingFeedback('/automations/message-funnels')).toBe(false);
    expect(hidesFloatingFeedback('/dashboard')).toBe(false);
  });
});
