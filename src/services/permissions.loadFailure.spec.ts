import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/core', () => ({ apiAuth: { get: (...a: unknown[]) => mocks.get(...a) } }));

import { permissionsService } from './permissions';

// O serviço engole a falha de /permissions e devolve lista vazia (outros
// chamadores dependem disso). A marca é o que diz à tela se a lista vazia é
// resposta do cargo ou queda de rede.
describe('permissionsService: a leitura de /permissions que falha deixa marca', () => {
  beforeEach(() => {
    permissionsService.clearCache();
    mocks.get.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('queda de rede (sem resposta): lista vazia e marca "failed"', async () => {
    mocks.get.mockRejectedValue(new Error('Network Error'));
    expect(await permissionsService.getAccountPermissions()).toEqual([]);
    expect(permissionsService.getPermissionsLoadFailure()).toBe('failed');
  });

  it('500 do servidor: marca "failed"', async () => {
    mocks.get.mockRejectedValue({ response: { status: 500 } });
    expect(await permissionsService.getUserPermissions()).toEqual([]);
    expect(permissionsService.getPermissionsLoadFailure()).toBe('failed');
  });

  it('403 de verdade: marca "forbidden"', async () => {
    mocks.get.mockRejectedValue({ response: { status: 403 } });
    await permissionsService.getAccountPermissions();
    expect(permissionsService.getPermissionsLoadFailure()).toBe('forbidden');
  });

  it('leitura que dá certo (mesmo vazia) limpa a marca', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Network Error'));
    await permissionsService.getAccountPermissions();
    mocks.get.mockResolvedValue({ data: { data: { permissions: [] } } });

    expect(await permissionsService.getAccountPermissions(true)).toEqual([]);
    expect(permissionsService.getPermissionsLoadFailure()).toBeNull();
  });

  it('trocar de pessoa (clearCache) limpa a marca', async () => {
    mocks.get.mockRejectedValue(new Error('Network Error'));
    await permissionsService.getAccountPermissions();
    permissionsService.clearCache();
    expect(permissionsService.getPermissionsLoadFailure()).toBeNull();
  });
});
