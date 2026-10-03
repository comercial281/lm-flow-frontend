import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const cap = vi.hoisted(() => ({ list: vi.fn() }));
const perfil = vi.hoisted(() => ({ updateUISettings: vi.fn() }));
vi.mock('@/services/propertyCaptureRequests/propertyCaptureRequestsService', () => ({ propertyCaptureRequestsService: cap }));
vi.mock('@/services/profile/profileService', () => ({ profileService: perfil }));

import { useAuthStore } from '@/store/authStore';
import type { UserResponse } from '@/types/auth';
import { CHAVE_VISTAS, useCaptacoesNovas } from './useCaptacoesNovas';

const usuario = (ui_settings: Record<string, unknown>) => ({ id: 'u1', email: 'a@b.c', name: 'Ana', ui_settings }) as unknown as UserResponse;

beforeEach(() => {
  vi.clearAllMocks();
  cap.list.mockResolvedValue({ data: [], meta: { total: 3 } });
  perfil.updateUISettings.mockResolvedValue({});
  useAuthStore.setState({ currentUser: usuario({ font_size: 'large' }) });
});
afterEach(() => vi.useRealTimers());

describe('useCaptacoesNovas', () => {
  it('sem ter aberto a aba nunca, conta todos os pendentes', async () => {
    const { result } = renderHook(() => useCaptacoesNovas(true));
    await waitFor(() => expect(result.current.tem).toBe(true));
    expect(cap.list).toHaveBeenCalledWith({ pending: 'true', per_page: '1' });
  });

  it('com data vista, conta só o que chegou depois', async () => {
    useAuthStore.setState({ currentUser: usuario({ [CHAVE_VISTAS]: '2026-10-01T10:00:00.000Z' }) });
    cap.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    const { result } = renderHook(() => useCaptacoesNovas(true));
    await waitFor(() => expect(cap.list).toHaveBeenCalledWith({ pending: 'true', per_page: '1', created_after: '2026-10-01T10:00:00.000Z' }));
    expect(result.current.tem).toBe(false);
  });

  it('inativo não pergunta ao servidor', () => {
    renderHook(() => useCaptacoesNovas(false));
    expect(cap.list).not.toHaveBeenCalled();
  });

  it('confere de novo a cada 2 minutos e para ao desmontar', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useCaptacoesNovas(true));
    expect(cap.list).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(cap.list).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(240000); });
    expect(cap.list).toHaveBeenCalledTimes(2);
  });

  it('erro de rede não acende a bolinha', async () => {
    cap.list.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useCaptacoesNovas(true));
    await waitFor(() => expect(cap.list).toHaveBeenCalled());
    expect(result.current.tem).toBe(false);
  });

  it('marcar como vistas grava a data e manda o objeto inteiro ao servidor', async () => {
    const { result } = renderHook(() => useCaptacoesNovas(true));
    await waitFor(() => expect(result.current.tem).toBe(true));
    cap.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    await act(async () => { await result.current.marcarComoVistas(); });
    const gravado = useAuthStore.getState().currentUser?.ui_settings?.[CHAVE_VISTAS];
    expect(typeof gravado).toBe('string');
    expect(perfil.updateUISettings).toHaveBeenCalledWith({ font_size: 'large', [CHAVE_VISTAS]: gravado });
    expect(result.current.tem).toBe(false);
  });
});
