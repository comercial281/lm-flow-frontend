import { describe, it, expect } from 'vitest';
import { extractError } from './apiHelpers';

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
