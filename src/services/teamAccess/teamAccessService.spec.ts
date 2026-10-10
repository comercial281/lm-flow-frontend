import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/core/apiAuth', () => ({ default: { get: (...a: unknown[]) => mocks.get(...a) } }));

import teamAccessService from './teamAccessService';

describe('teamAccessService.overview', () => {
  it('normaliza all_numbers para [] quando o servidor antigo não manda e preserva o que vem', async () => {
    const num = { inbox_id: 'i1', name: 'Comercial', phone: null, connection: null, principal: true, never_connected: true, owner: true };
    mocks.get.mockResolvedValue({
      data: { success: true, data: { inboxes: [], members: [{ id: '1' }, { id: '2', all_numbers: [num] }], number_owner_rule: true } },
    });
    const o = await teamAccessService.overview();
    expect(o.members[0].all_numbers).toEqual([]);
    expect(o.members[1].all_numbers).toEqual([num]);
    expect(o.number_owner_rule).toBe(true);
  });
});
