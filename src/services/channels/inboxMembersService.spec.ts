import { beforeEach, describe, expect, it, vi } from 'vitest';
import InboxMembersService from './inboxMembersService';
import api from '@/services/core/api';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/* `add` e `remove` mexem numa pessoa só, sem ler a lista antes. Ler e devolver a
   lista inteira (o PATCH) apaga todo mundo quando a leitura falha (o `get`
   devolve [] no erro) e promove à distribuição quem só tinha acesso automático. */
describe('InboxMembersService.add', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /inbox_members com o número e só as pessoas que entram', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: [] } } as never);
    await InboxMembersService.add('30', ['a1']);
    expect(api.post).toHaveBeenCalledWith('/inbox_members', { inbox_id: '30', user_ids: ['a1'] });
    expect(api.get).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('erro do servidor sobe para a tela (não vira sucesso calado)', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('403'));
    await expect(InboxMembersService.add('30', ['a1'])).rejects.toThrow('403');
  });
});

describe('InboxMembersService.remove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DELETE /inbox_members com só quem sai', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} } as never);
    await InboxMembersService.remove('20', ['a1']);
    expect(api.delete).toHaveBeenCalledWith('/inbox_members', { data: { inbox_id: '20', user_ids: ['a1'] } });
    expect(api.get).not.toHaveBeenCalled();
  });
});
