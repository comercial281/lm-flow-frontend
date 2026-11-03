import { describe, it, expect } from 'vitest';
import { speaksAsBroker } from './handoffVoice';

// No WhatsApp de uma corretora, a IA dizia "vou passar pro meu colega do time".
// A chave faz ela falar como a própria corretora — e a escolha não pode sumir.
describe('handoffVoice', () => {
  it('é o padrão de sempre enquanto ninguém ligar', () => {
    expect(speaksAsBroker(undefined)).toBe(false);
    expect(speaksAsBroker(null)).toBe(false);
    expect(speaksAsBroker({ mode: 'duvida' })).toBe(false);
    expect(speaksAsBroker({ voice: 'first_person' })).toBe(true);
  });
});
