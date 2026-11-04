import { describe, it, expect } from 'vitest';
import { camposDePublicacao, estaAgendado, paraCampo } from './agendaDoPost';

describe('agenda do post', () => {
  it('campo vazio não mexe em data nem status', () => {
    expect(camposDePublicacao('')).toEqual({});
    expect(camposDePublicacao('   ')).toEqual({});
    expect(camposDePublicacao('lixo')).toEqual({});
  });

  it('campo preenchido publica com a data (ISO)', () => {
    const r = camposDePublicacao('2030-01-15T09:30');
    expect(r.status).toBe('published');
    expect(new Date(r.published_at!).getTime()).toBe(new Date('2030-01-15T09:30').getTime());
  });

  it('ida e volta do campo preserva a data e a hora', () => {
    const iso = new Date('2030-01-15T09:30').toISOString();
    expect(paraCampo(iso)).toBe('2030-01-15T09:30');
    expect(paraCampo(null)).toBe('');
    expect(paraCampo('xx')).toBe('');
  });

  it('agendado = publicado com data no futuro', () => {
    const agora = new Date('2030-01-01T00:00:00Z');
    expect(estaAgendado({ status: 'published', published_at: '2030-02-01T00:00:00Z' }, agora)).toBe(true);
    expect(estaAgendado({ status: 'published', published_at: '2029-12-01T00:00:00Z' }, agora)).toBe(false);
    expect(estaAgendado({ status: 'draft', published_at: '2030-02-01T00:00:00Z' }, agora)).toBe(false);
    expect(estaAgendado({ status: 'published', published_at: null }, agora)).toBe(false);
  });
});
