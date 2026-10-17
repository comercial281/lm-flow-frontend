import { describe, it, expect } from 'vitest';
import { FLOW_ONLY_TRIGGERS, TRIGGER_LABELS } from '@/services/leadAutomation/leadAutomationService';

// "Pediu o book no site" só existe no construtor de fluxos; o servidor recusa
// regra antiga com ele.

describe('Gatilhos só do construtor nas Automações antigas', () => {
  it('lead.book_requested é só do construtor e mantém o rótulo pra exibição', () => {
    expect(FLOW_ONLY_TRIGGERS).toContain('lead.book_requested');
    expect(TRIGGER_LABELS['lead.book_requested']).toBe('Pediu o book no site');
  });

});
