import { describe, it, expect } from 'vitest';
import { permissionGate, type PermissionGateInput } from './permissionGate';

const base: PermissionGateInput = {
  isSuperAdmin: false, loading: false, isReady: true, hasPermission: false, loadFailure: null,
};

describe('o que o PermissionRoute mostra', () => {
  it('leitura das permissões caiu (rede/5xx) e a lista veio vazia: tentar de novo, não o aviso do cargo', () => {
    expect(permissionGate({ ...base, loadFailure: 'failed' })).toBe('retry');
  });

  it('403 de verdade continua sendo o aviso do cargo', () => {
    expect(permissionGate({ ...base, loadFailure: 'forbidden' })).toBe('deny');
  });

  it('lista lida com sucesso sem a chave: aviso do cargo', () => {
    expect(permissionGate(base)).toBe('deny');
  });

  it('com a permissão abre, mesmo se uma leitura tiver falhado', () => {
    expect(permissionGate({ ...base, hasPermission: true, loadFailure: 'failed' })).toBe('allow');
  });

  it('carregando: nem aviso, nem tentar de novo, nem tela', () => {
    expect(permissionGate({ ...base, loading: true, loadFailure: 'failed' })).toBe('loading');
    expect(permissionGate({ ...base, isReady: false, loadFailure: 'failed' })).toBe('loading');
  });

  it('suporte abre sem esperar as permissões', () => {
    expect(permissionGate({ ...base, isSuperAdmin: true, isReady: false, loadFailure: 'failed' })).toBe('allow');
  });
});
