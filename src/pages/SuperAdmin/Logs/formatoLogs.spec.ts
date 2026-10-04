import { describe, it, expect } from 'vitest';
import { quemFez, rotuloCategoria } from './formatoLogs';

describe('formatoLogs', () => {
  it('rótulos de categoria sem jargão', () => {
    expect(rotuloCategoria('request')).toBe('Ação no sistema');
    expect(rotuloCategoria('channel')).toBe('Número de WhatsApp');
    expect(rotuloCategoria('message')).toBe('Mensagem');
    expect(rotuloCategoria('desconhecida')).toBe('desconhecida');
  });
  it('quem fez', () => {
    expect(quemFez({ actor_name: 'Tony', actor_email: 't@x.com', actor_type: 'EquipeLealMidia' })).toBe('Tony');
    expect(quemFez({ actor_name: null, actor_email: 't@x.com', actor_type: 'User' })).toBe('t@x.com');
    expect(quemFez({ actor_name: null, actor_email: null, actor_type: null })).toBe('Sistema');
    expect(quemFez({ actor_name: 'Chave SaaS', actor_email: null, actor_type: 'ChaveSaaS' })).toBe('Chave SaaS');
  });
});
