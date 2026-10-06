import { describe, it, expect } from 'vitest';
import { isForbiddenError, requiredPermissionOf, classifyLoadFailure, serverRefusalMessageOf } from './forbidden';

const recusa = { response: { status: 403, data: { required_permission: 'sales_agents.read' } } };

describe('leitor único da recusa por cargo', () => {
  it('reconhece o 403 do servidor e a permissão que faltou', () => {
    expect(isForbiddenError(recusa)).toBe(true);
    expect(requiredPermissionOf(recusa)).toBe('sales_agents.read');
    expect(classifyLoadFailure(recusa)).toBe('forbidden');
  });

  it('rede caída, 500 e 401 NÃO são recusa de cargo', () => {
    expect(classifyLoadFailure(new Error('Network Error'))).toBe('failed');
    expect(classifyLoadFailure({ response: { status: 500 } })).toBe('failed');
    expect(classifyLoadFailure({ response: { status: 401 } })).toBe('failed');
    expect(classifyLoadFailure(null)).toBe('failed');
  });

  it('sem o motivo no corpo, a permissão fica indefinida', () => {
    expect(requiredPermissionOf({ response: { status: 403, data: {} } })).toBeUndefined();
  });
});

describe('serverRefusalMessageOf', () => {
  const erro = (status: number, data: unknown) => ({ response: { status, data } });

  it('lê a mensagem aninhada e a da raiz', () => {
    expect(serverRefusalMessageOf(erro(403, { error: { message: 'Aceite o lead pelo botão Aceitar.' } }))).toBe(
      'Aceite o lead pelo botão Aceitar.',
    );
    expect(serverRefusalMessageOf(erro(403, { message: 'Oi' }))).toBe('Oi');
  });

  it('vazio para recusa de cargo, outro status, sem mensagem ou erro sem resposta', () => {
    expect(serverRefusalMessageOf(erro(403, { message: 'x', required_permission: 'a.b' }))).toBeUndefined();
    expect(serverRefusalMessageOf(erro(500, { message: 'x' }))).toBeUndefined();
    expect(serverRefusalMessageOf(erro(403, { error: 'Forbidden' }))).toBeUndefined();
    expect(serverRefusalMessageOf(new Error('rede'))).toBeUndefined();
    expect(serverRefusalMessageOf(null)).toBeUndefined();
  });
});
