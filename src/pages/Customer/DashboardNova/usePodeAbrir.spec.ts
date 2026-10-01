import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePodeAbrir } from './usePodeAbrir';

const podeMock = vi.fn((_resource: string, _action: string) => true);
let chavesDesligadas: string[] = [];

vi.mock('@/hooks/useCan', () => ({
  useCan: () => podeMock,
}));

vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useFeature: (key?: string) => !key || !chavesDesligadas.includes(key),
}));

const abrir = () => renderHook(() => usePodeAbrir()).result.current;

describe('usePodeAbrir', () => {
  beforeEach(() => {
    podeMock.mockReset();
    podeMock.mockImplementation(() => true);
    chavesDesligadas = [];
  });

  it('cargo que abre tudo, com tudo ligado, abre todos os destinos', () => {
    expect(abrir()).toEqual({ imoveis: true, agenda: true, propostas: true, funil: true, roleta: true });
  });

  it.each([
    ['properties', 'imoveis'],
    ['visits', 'agenda'],
    ['proposals', 'propostas'],
    ['pipelines', 'funil'],
  ] as const)('chave %s desligada no cliente: %s não abre, mesmo com o cargo', (chave, destino) => {
    chavesDesligadas = [chave];
    const pode = abrir();
    expect(pode[destino]).toBe(false);
    const outros = Object.entries(pode).filter(([k]) => k !== destino);
    expect(outros.every(([, v]) => v)).toBe(true);
  });

  it('sem o cargo, o destino não abre mesmo com a chave ligada', () => {
    podeMock.mockImplementation((resource: string) => resource !== 'visits');
    expect(abrir().agenda).toBe(false);
  });

  it('a roleta depende da fila do cargo (roleta_configs.queue)', () => {
    podeMock.mockImplementation((resource: string, action: string) => !(resource === 'roleta_configs' && action === 'queue'));
    expect(abrir().roleta).toBe(false);
  });
});
