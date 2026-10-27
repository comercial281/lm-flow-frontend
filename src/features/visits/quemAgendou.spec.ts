import { describe, expect, it } from 'vitest';
import { quemAgendou } from './quemAgendou';

describe('quemAgendou', () => {
  it('IA', () => {
    expect(quemAgendou({ booked_by: 'ia' })).toEqual({ tipo: 'ia', rotulo: 'Agendada pela IA Vendedora' });
  });
  it('pessoa com nome', () => {
    expect(quemAgendou({ booked_by: 'pessoa', created_by: { id: '1', name: 'Marina' } })).toEqual({
      tipo: 'pessoa',
      rotulo: 'Agendada por Marina',
    });
  });
  it('pessoa sem nome', () => {
    expect(quemAgendou({ booked_by: 'pessoa', created_by: null })?.rotulo).toBe('Agendada por alguém do time');
  });
  it('sem autor', () => {
    expect(quemAgendou({ booked_by: null })).toBeNull();
    expect(quemAgendou({})).toBeNull();
  });
});
