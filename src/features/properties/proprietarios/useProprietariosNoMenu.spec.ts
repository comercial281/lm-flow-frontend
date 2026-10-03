import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const own = vi.hoisted(() => ({ count: vi.fn() }));
const cap = vi.hoisted(() => ({ list: vi.fn() }));
const chaves = vi.hoisted(() => ({ atual: new Set<string>() }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: own }));
vi.mock('@/services/propertyCaptureRequests/propertyCaptureRequestsService', () => ({ propertyCaptureRequestsService: cap }));
vi.mock('@/services/profile/profileService', () => ({ profileService: { updateUISettings: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => chaves.atual.has(`${r}.${a}`) }));

import { useProprietariosNoMenu } from './menuDeProprietarios';

const GESTOR = ['properties.read', 'properties.update', 'property_capture_requests.read'];
const CORRETOR = ['properties.read'];

beforeEach(() => {
  vi.clearAllMocks();
  cap.list.mockResolvedValue({ data: [], meta: { total: 1 } });
});

describe('useProprietariosNoMenu', () => {
  it('gestor sempre vê, sem contar proprietários, e ganha a bolinha', async () => {
    chaves.atual = new Set(GESTOR);
    const { result } = renderHook(() => useProprietariosNoMenu());
    expect(result.current.visivel).toBe(true);
    await waitFor(() => expect(result.current.marcador).toBe(true));
    expect(own.count).not.toHaveBeenCalled();
  });

  it('corretor com proprietário liberado vê', async () => {
    chaves.atual = new Set(CORRETOR);
    own.count.mockResolvedValue(2);
    const { result } = renderHook(() => useProprietariosNoMenu());
    await waitFor(() => expect(result.current.visivel).toBe(true));
    expect(own.count).toHaveBeenCalledTimes(1);
  });

  it('corretor sem proprietário não vê e não pergunta por captação', async () => {
    chaves.atual = new Set([...CORRETOR, 'property_capture_requests.read']);
    own.count.mockResolvedValue(0);
    const { result } = renderHook(() => useProprietariosNoMenu());
    await waitFor(() => expect(own.count).toHaveBeenCalled());
    expect(result.current).toEqual({ visivel: false, marcador: false });
    expect(cap.list).not.toHaveBeenCalled();
  });

  it('erro ao contar esconde', async () => {
    chaves.atual = new Set(CORRETOR);
    own.count.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useProprietariosNoMenu());
    await waitFor(() => expect(own.count).toHaveBeenCalled());
    expect(result.current.visivel).toBe(false);
  });

  it('sem ler imóveis não conta nem pergunta nada', () => {
    chaves.atual = new Set(['property_capture_requests.read']);
    const { result } = renderHook(() => useProprietariosNoMenu());
    expect(result.current).toEqual({ visivel: false, marcador: false });
    expect(own.count).not.toHaveBeenCalled();
    expect(cap.list).not.toHaveBeenCalled();
  });
});
