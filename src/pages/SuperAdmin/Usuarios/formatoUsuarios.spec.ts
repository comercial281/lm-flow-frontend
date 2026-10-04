import { describe, it, expect } from 'vitest';
import { duracao, rotuloNotificacao, statusDaNotificacao } from './formatoUsuarios';

describe('duracao', () => {
  it('formata minutos e horas', () => {
    expect(duracao(720)).toBe('12 min');
    expect(duracao(4800)).toBe('1 h 20 min');
    expect(duracao(3600)).toBe('1 h');
  });
  it('menos de um minuto não vira traço', () => {
    expect(duracao(30)).toBe('< 1 min');
    expect(duracao(59)).toBe('< 1 min');
  });
  it('zero e nulo viram traço', () => {
    expect(duracao(0)).toBe('—');
    expect(duracao(null)).toBe('—');
  });
});

describe('notificação', () => {
  it('rótulos e cores', () => {
    expect(rotuloNotificacao('ok')).toBe('Ok');
    expect(rotuloNotificacao('bloqueada')).toBe('Bloqueada');
    expect(rotuloNotificacao('falhando')).toBe('Falhando');
    expect(rotuloNotificacao(null)).toBe('—');
    expect(statusDaNotificacao('ok')).toBe('success');
    expect(statusDaNotificacao('bloqueada')).toBe('error');
    expect(statusDaNotificacao('falhando')).toBe('warning');
    expect(statusDaNotificacao(null)).toBe('inactive');
  });
});
