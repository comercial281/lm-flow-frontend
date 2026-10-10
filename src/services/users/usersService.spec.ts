import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiErrorMessage } from '@/utils/apiHelpers';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/services/core/apiAuth', () => ({ default: { post: (...a: unknown[]) => mocks.post(...a) } }));

import usersService from './usersService';

// chaves: beforeEach que devolve o mock seria tratado como "limpeza" e chamado no fim do teste
beforeEach(() => {
  mocks.post.mockReset();
});

describe('usersService.createWhatsappNumber', () => {
  it('posta nome e telefone e devolve o número criado', async () => {
    const data = { inbox_id: 'i1', name: 'Comercial', phone: '5511999999999', connection: 'connecting' };
    mocks.post.mockResolvedValue({ data: { success: true, data } });
    await expect(
      usersService.createWhatsappNumber('u1', { name: 'Comercial', phone_number: '5511999999999' }),
    ).resolves.toEqual(data);
    expect(mocks.post).toHaveBeenCalledWith('/users/u1/whatsapp_number', { name: 'Comercial', phone_number: '5511999999999' });
  });

  it('repassa o erro do servidor e a frase pronta fica legível', async () => {
    const err = Object.assign(new Error('Request failed'), { response: { status: 422, data: { success: false, error: { code: 'phone_taken', message: 'Esse telefone já é do número Vendas.' } } } });
    mocks.post.mockImplementation(async () => {
      throw err;
    });
    const pending = usersService.createWhatsappNumber('u1', { name: 'x', phone_number: '1' });
    await expect(pending).rejects.toBe(err);
    expect(apiErrorMessage(err, 'fallback')).toBe('Esse telefone já é do número Vendas.');
  });
});

describe('usersService.bulkAdd', () => {
  it('manda pessoas, cargo e send_access e devolve invited/skipped/refused', async () => {
    const result = { invited: [{ id: '1', name: 'Ana', email: 'a@x.com', access: 'sent' }], skipped: [], refused: [] };
    mocks.post.mockResolvedValue({ data: { success: true, data: result } });
    const params = { people: [{ name: 'Ana', email: 'a@x.com', whatsapp_number: '5511' }], chave_role: 'agent' as const, send_access: true };
    await expect(usersService.bulkAdd(params)).resolves.toEqual(result);
    expect(mocks.post).toHaveBeenCalledWith('/users/bulk_create', params);
  });
});
