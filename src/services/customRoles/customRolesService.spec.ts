import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/apiAuth', () => ({ default: { get: s.get, patch: s.patch } }));

import { customRolesService } from './customRolesService';

describe('customRolesService — permissões por linha', () => {
  beforeEach(() => vi.clearAllMocks());

  it('capabilities() lê temas e cargos de data', async () => {
    const data = { themes: [{ key: 'a', label: 'A', rows: [] }], roles: [{ id: 1, states: { x: 'on' } }] };
    s.get.mockResolvedValue({ data: { success: true, data } });
    expect(await customRolesService.capabilities()).toEqual(data);
    expect(s.get).toHaveBeenCalledWith('/roles/capabilities');
  });

  it('updateCapabilities() manda { changes } e devolve o cargo com states', async () => {
    const role = { id: 7, states: { x: 'off' } };
    s.patch.mockResolvedValue({ data: { success: true, data: role } });
    expect(await customRolesService.updateCapabilities(7, { x: false })).toEqual(role);
    expect(s.patch).toHaveBeenCalledWith('/roles/7/capabilities', { changes: { x: false } });
  });
});
