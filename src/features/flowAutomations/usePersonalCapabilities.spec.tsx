import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const personalCapabilities = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { personalCapabilities },
}));

import { usePersonalCapabilities } from './usePersonalCapabilities';

beforeEach(() => { personalCapabilities.mockReset(); });

describe('usePersonalCapabilities', () => {
  it('lê do servidor: número próprio, telefone e IA', async () => {
    personalCapabilities.mockResolvedValue({ tem_numero: true, numero: '+5511999990000', tem_ia: true });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ temNumero: true, temIA: true, principalPhone: '+5511999990000', loading: false });
  });

  it('sem número próprio: tudo falso (mesmo se o servidor mandar IA)', async () => {
    personalCapabilities.mockResolvedValue({ tem_numero: false, numero: null, tem_ia: true });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(false);
    expect(result.current.temIA).toBe(false);
    expect(result.current.principalPhone).toBeNull();
  });

  it('número sem IA', async () => {
    personalCapabilities.mockResolvedValue({ tem_numero: true, numero: '+5511', tem_ia: false });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(true);
    expect(result.current.temIA).toBe(false);
  });

  it('enquanto carrega: fecha (não tem)', () => {
    personalCapabilities.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePersonalCapabilities(true));
    expect(result.current).toEqual({ temNumero: false, temIA: false, principalPhone: null, loading: true });
  });

  it('erro: fecha (não tem)', async () => {
    personalCapabilities.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(false);
    expect(result.current.temIA).toBe(false);
  });

  it('desligado: não chama o servidor', () => {
    renderHook(() => usePersonalCapabilities(false));
    expect(personalCapabilities).not.toHaveBeenCalled();
  });
});
