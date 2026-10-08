import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { listOptionsService, type ListOption } from './listOptionsService';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const MOTIVO: ListOption = {
  id: 'o1', list_key: 'loss_reasons', label: 'Adiou a compra', position: 0, active: true, meta_exclusion: false,
};

describe('listOptionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: GET /list_options?list=, com ou sem o envelope { data }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, data: [MOTIVO] } } as never);
    expect(await listOptionsService.list('loss_reasons')).toEqual([MOTIVO]);
    expect(api.get).toHaveBeenCalledWith('/list_options', { params: { list: 'loss_reasons' } });

    vi.mocked(api.get).mockResolvedValueOnce({ data: [MOTIVO] } as never);
    expect(await listOptionsService.list('loss_reasons')).toEqual([MOTIVO]);
  });

  it('list com as arquivadas manda include_inactive=true', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } } as never);
    await listOptionsService.list('task_categories', { includeInactive: true });
    expect(api.get).toHaveBeenCalledWith('/list_options', { params: { list: 'task_categories', include_inactive: 'true' } });
  });

  it('create: POST com list_key e o nome', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: MOTIVO } } as never);
    expect(await listOptionsService.create('loss_reasons', { label: 'Adiou a compra' })).toEqual(MOTIVO);
    expect(api.post).toHaveBeenCalledWith('/list_options', { list_key: 'loss_reasons', label: 'Adiou a compra' });
  });

  it('update: PATCH /list_options/:id só com o que mudou', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...MOTIVO, active: false } } } as never);
    expect((await listOptionsService.update('o1', { active: false })).active).toBe(false);
    expect(api.patch).toHaveBeenCalledWith('/list_options/o1', { active: false });
  });

  it('reorder: PATCH /list_options/reorder com { list, ids } e devolve a lista inteira', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: [MOTIVO] } } as never);
    expect(await listOptionsService.reorder('loss_reasons', ['o2', 'o1'])).toEqual([MOTIVO]);
    expect(api.patch).toHaveBeenCalledWith('/list_options/reorder', { list: 'loss_reasons', ids: ['o2', 'o1'] });
  });
});
