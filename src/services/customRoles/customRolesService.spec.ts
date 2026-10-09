import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/apiAuth', () => ({ default: { get: s.get, patch: s.patch } }));

import { customRolesService, capabilitiesErrorMessage } from './customRolesService';

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

describe('capabilitiesErrorMessage', () => {
  const com = (data: unknown) => ({ response: { data } });
  it('lê error em texto primeiro, depois error.message, depois message', () => {
    expect(capabilitiesErrorMessage(com({ error: 'O administrador sempre pode tudo.' }), 'x')).toBe('O administrador sempre pode tudo.');
    expect(capabilitiesErrorMessage(com({ error: { message: 'A' } }), 'x')).toBe('A');
    expect(capabilitiesErrorMessage(com({ message: 'M' }), 'x')).toBe('M');
  });
  it('com error e message em texto, prefere a message (403 do RBAC: error em inglês)', () => {
    expect(capabilitiesErrorMessage(com({ error: 'Forbidden', message: 'Seu cargo não pode.' }), 'x')).toBe('Seu cargo não pode.');
  });
  it('sem nada, usa o texto reserva', () => {
    expect(capabilitiesErrorMessage(new Error('boom'), 'reserva')).toBe('reserva');
    expect(capabilitiesErrorMessage(com({ error: '' }), 'reserva')).toBe('reserva');
  });
});
