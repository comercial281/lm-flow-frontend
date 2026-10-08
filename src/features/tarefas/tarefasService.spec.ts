import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/services/core/api', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a) },
}));

import { EVENTO_TAREFAS_MUDARAM, motivoDoErro, tarefasService } from './tarefasService';

beforeEach(() => { get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset(); });

describe('tarefasService', () => {
  it('lista com os cards juntos por vírgula', async () => {
    get.mockResolvedValue({ data: { data: [], meta: { counts: {}, total: 0, page: 1, per_page: 30, only_mine: true } } });
    const r = await tarefasService.listar({ bucket: 'hoje', pipeline_item_ids: ['a', 'b'] });
    expect(get).toHaveBeenCalledWith('/activities', { params: { bucket: 'hoje', pipeline_item_ids: 'a,b' } });
    expect(r.meta.only_mine).toBe(true);
  });

  it('criar avisa as outras telas', async () => {
    post.mockResolvedValue({ data: { data: { kind: 'task', id: 't1' } } });
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, ouvinte);
    await tarefasService.criar({ pipeline_item_id: 'c1', title: 'Ligar', due_date: '2026-10-08T13:00:00.000Z' });
    expect(post).toHaveBeenCalledWith('/tasks', { task: { pipeline_item_id: 'c1', title: 'Ligar', due_date: '2026-10-08T13:00:00.000Z' } });
    expect(ouvinte).toHaveBeenCalled();
    window.removeEventListener(EVENTO_TAREFAS_MUDARAM, ouvinte);
  });

  it('lê o motivo do lead sem card', () => {
    const erro = { response: { data: { error: { details: { motivo: 'lead_sem_card' } } } } };
    expect(motivoDoErro(erro)).toBe('lead_sem_card');
    expect(motivoDoErro(new Error('x'))).toBeNull();
  });
});
