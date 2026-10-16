import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const myNumbers = vi.hoisted(() => vi.fn());
const numberCard = vi.hoisted(() => vi.fn());
vi.mock('@/services/numbers/numbersService', () => ({ default: { myNumbers, numberCard } }));

import { usePersonalCapabilities } from './usePersonalCapabilities';

const num = (over: Record<string, unknown>) => ({
  inbox_id: 'i1', name: 'N', phone: '5511', connection: 'connected', principal: true, ...over,
});

beforeEach(() => { myNumbers.mockReset(); numberCard.mockReset(); });

describe('usePersonalCapabilities', () => {
  it('sem número: temNumero e temIA falsos', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [] });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(false);
    expect(result.current.temIA).toBe(false);
    expect(numberCard).not.toHaveBeenCalled();
  });

  it('número desconectado não conta', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [num({ connection: 'disconnected' })] });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(false);
  });

  it('principal com IA: temIA verdadeiro e devolve o telefone', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [num({})] });
    numberCard.mockResolvedValue({ ai: ['Sofia'] });
    const { result } = renderHook(() => usePersonalCapabilities(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.temNumero).toBe(true);
    expect(result.current.temIA).toBe(true);
    expect(result.current.principalPhone).toBe('5511');
    expect(numberCard).toHaveBeenCalledWith('i1');
  });

  it('desligado: não chama o servidor', () => {
    renderHook(() => usePersonalCapabilities(false));
    expect(myNumbers).not.toHaveBeenCalled();
  });
});
