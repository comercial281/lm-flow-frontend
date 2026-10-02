import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let numeros: unknown[] | null = null;
let prontas = true;
let gestor = false;
vi.mock('./useNumerosDaConversa', () => ({
  useNumerosDaConversa: () => ({ inboxes: null, numeros }),
}));
vi.mock('react', async (orig) => {
  const real = await orig<typeof import('react')>();
  return { ...real, useContext: () => ({ isReady: prontas }) };
});
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string) => (r === 'inboxes' ? gestor : false) }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => false }));
vi.mock('@/contexts/PermissionsContext', () => ({ PermissionsContext: {} }));

import { useAvisoDeNumero } from './useAvisoDeNumero';

const numero = (status: string) => ({
  id: 1,
  name: 'Número A',
  connection_status: status,
  owner_user_id: 'u1',
});

describe('useAvisoDeNumero', () => {
  beforeEach(() => {
    numeros = null;
    prontas = true;
    gestor = false;
  });

  it('corretor sem número: semNumero', () => {
    numeros = [];
    const { result } = renderHook(() => useAvisoDeNumero());
    expect(result.current).toMatchObject({ tipo: 'semNumero', gestor: false });
  });

  it('número fora do ar: foraDoAr', () => {
    numeros = [numero('disconnected')];
    const { result } = renderHook(() => useAvisoDeNumero());
    expect(result.current?.tipo).toBe('foraDoAr');
  });

  it('número no ar: null', () => {
    numeros = [numero('connected')];
    const { result } = renderHook(() => useAvisoDeNumero());
    expect(result.current).toBeNull();
  });

  it('lista nula: null', () => {
    const { result } = renderHook(() => useAvisoDeNumero());
    expect(result.current).toBeNull();
  });

  it('permissões não prontas: null', () => {
    numeros = [];
    prontas = false;
    const { result } = renderHook(() => useAvisoDeNumero());
    expect(result.current).toBeNull();
  });
});
