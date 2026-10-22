import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { demoRoomService } from './demoRoomService';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const naoAchou = { response: { status: 404, data: { error: { message: 'Not found' } } } };
const ENCERRADA = 'Essa demonstração já foi encerrada. Recarregue a página.';

describe('demoRoomService: demonstração que já acabou', () => {
  beforeEach(() => vi.clearAllMocks());

  it('followupNow com 404 explica que a demonstração foi encerrada', async () => {
    vi.mocked(api.post).mockRejectedValue(naoAchou);
    await expect(demoRoomService.followupNow('s1')).rejects.toThrow(ENCERRADA);
  });

  it('reset com 404 explica que a demonstração foi encerrada', async () => {
    vi.mocked(api.post).mockRejectedValue(naoAchou);
    await expect(demoRoomService.reset('s1')).rejects.toThrow(ENCERRADA);
  });

  it('outro erro continua com a mensagem do servidor', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { error: { message: 'Sem follow-up configurado' } } } });
    await expect(demoRoomService.followupNow('s1')).rejects.toThrow('Sem follow-up configurado');
  });
});
