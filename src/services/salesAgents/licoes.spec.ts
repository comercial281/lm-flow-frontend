import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get, patch } }));

import { salesAgentsService, LIMITES_PADRAO } from './salesAgentsService';

beforeEach(() => { get.mockReset(); patch.mockReset(); });

describe('lições no serviço', () => {
  it('lista com os limites do servidor', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'l1', in_use: false }], meta: { limits: { per_kind: 10, conversations: 4 } } } });
    const r = await salesAgentsService.listLessons('ia-1');
    expect(r.limites).toEqual({ per_kind: 10, conversations: 4 });
    expect(r.licoes[0].in_use).toBe(false);
  });

  it('servidor velho: limites padrão e in_use ausente vale', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'l1', kind: 'rule', content: 'x', enabled: true }] } });
    const r = await salesAgentsService.listLessons('ia-1');
    expect(r.limites).toEqual(LIMITES_PADRAO);
    expect(r.licoes[0]).toMatchObject({ in_use: true, origin: 'manual' });
  });

  it('edita pelo PATCH', async () => {
    patch.mockResolvedValue({ data: { data: { id: 'l1', enabled: false } } });
    await salesAgentsService.updateLesson('ia-1', 'l1', { enabled: false });
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/ia-1\/lessons\/l1$/), { enabled: false });
  });
});
