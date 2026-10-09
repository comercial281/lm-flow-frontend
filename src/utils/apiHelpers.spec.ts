import { describe, it, expect } from 'vitest';
import { apiErrorMessage, extractError } from './apiHelpers';

const axiosErro = (status: number, data: unknown) => ({ response: { status, statusText: 'x', data } });

/**
 * A API tem DOIS formatos de erro, e a recusa por cargo é um terceiro
 * disfarçado de legado: `error` como texto genérico e a explicação em
 * `message`. Quem lê a mensagem de erro para mostrar num toast passa por aqui —
 * ler só um formato faz "seu cargo não permite esta ação" virar frase genérica.
 */
describe('extractError', () => {
  it('formato padrão: { success: false, error: { code, message, details } }', () => {
    const info = extractError(axiosErro(422, {
      success: false,
      error: { code: 'AD_PLAN_EXCEEDED', message: 'Destaque: 41 de 40', details: { overflows: [] } },
    }));
    expect(info).toEqual({ code: 'AD_PLAN_EXCEEDED', message: 'Destaque: 41 de 40', details: { overflows: [] } });
  });

  it('recusa por cargo: `error` texto + `message` explicando — vale a explicação', () => {
    const info = extractError(axiosErro(403, {
      error: 'Forbidden - Insufficient permissions',
      message: 'Seu cargo não permite esta ação',
      required_permission: 'integrations.update',
    }));
    expect(info.message).toBe('Seu cargo não permite esta ação');
    expect(info.details).toEqual({ required_permission: 'integrations.update' });
  });

  it('legado só com `error` texto continua valendo o texto', () => {
    expect(extractError(axiosErro(404, { error: 'Portal não conectado' })).message).toBe('Portal não conectado');
    // `message` vazio não substitui o `error`.
    expect(extractError(axiosErro(404, { error: 'Portal não conectado', message: '  ' })).message).toBe('Portal não conectado');
  });

  it('legado { message, attributes } e falha de rede', () => {
    expect(extractError(axiosErro(422, { message: 'E-mail inválido', attributes: ['email'] })))
      .toEqual({ code: 'VALIDATION_ERROR', message: 'E-mail inválido', details: ['email'] });
    expect(extractError({ request: {} }).code).toBe('NETWORK_ERROR');
    expect(extractError(new Error('boom')).message).toBe('boom');
  });
});

describe('apiErrorMessage', () => {
  const com = (data: unknown) => ({ response: { data } });
  it('aceita error como objeto, como string e message solta', () => {
    expect(apiErrorMessage(com({ error: { message: 'A' } }), 'x')).toBe('A');
    expect(apiErrorMessage(com({ success: false, error: 'O administrador sempre pode tudo.' }), 'x')).toBe('O administrador sempre pode tudo.');
    expect(apiErrorMessage(com({ message: 'M' }), 'x')).toBe('M');
    // formato legado: error é rótulo genérico, a explicação está em message
    expect(apiErrorMessage(com({ error: 'Forbidden', message: 'Seu cargo não pode.' }), 'x')).toBe('Seu cargo não pode.');
  });
  it('cai no texto reserva', () => {
    expect(apiErrorMessage(new Error('boom'), 'reserva')).toBe('reserva');
    expect(apiErrorMessage(com({ error: '' }), 'reserva')).toBe('reserva');
  });
});
