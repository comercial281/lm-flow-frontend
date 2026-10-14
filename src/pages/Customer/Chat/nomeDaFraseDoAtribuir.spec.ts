import { describe, expect, it } from 'vitest';
import type { Conversation } from '@/types/chat/api';
import { nomeDaFraseDoAtribuir } from './nomeDaFraseDoAtribuir';

describe('nomeDaFraseDoAtribuir', () => {
  it('a frase cita o lead, não o atendente atual', () => {
    const c = { contact: { name: 'Maria Lead' }, assignee: { name: 'Joao Corretor' }, team: { name: 'Time A' } } as unknown as Conversation;
    expect(nomeDaFraseDoAtribuir(c, 'este contato')).toBe('Maria Lead');
  });
  it('sem nome do lead cai na alternativa', () => {
    const c = { assignee: { name: 'Joao' } } as unknown as Conversation;
    expect(nomeDaFraseDoAtribuir(c, 'este contato')).toBe('este contato');
  });
});
