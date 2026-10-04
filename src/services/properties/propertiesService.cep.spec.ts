import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: http }));
import { propertiesService } from './propertiesService';

beforeEach(() => vi.clearAllMocks());

describe('CEP e ponto', () => {
  it('lê as chaves que o servidor manda (address_*)', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: { address_street: 'Rua Barão de Jaguara', address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP' } } });
    await expect(propertiesService.cepLookup('13015002')).resolves.toMatchObject({ address_street: 'Rua Barão de Jaguara', address_city: 'Campinas' });
  });
  it('geocode desembrulha o envelope', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: { lat: -22.9, lng: -47.06, precision: 'street', failed: false } } });
    await expect(propertiesService.geocode({ street: 'Rua X', city: 'Campinas', state: 'SP' }))
      .resolves.toEqual({ lat: -22.9, lng: -47.06, precision: 'street', failed: false });
    expect(http.get).toHaveBeenCalledWith('/properties/geocode', { params: { street: 'Rua X', city: 'Campinas', state: 'SP' } });
  });
});
