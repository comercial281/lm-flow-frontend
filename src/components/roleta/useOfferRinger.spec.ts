import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const playLeadAlert = vi.fn(async () => true);
let lider = true;
vi.mock('@/lib/plantaoSound/leadAlert', () => ({
  playLeadAlert: () => playLeadAlert(),
  isRingLeader: () => lider,
}));

import { useOfferRinger, RING_MS } from './useOfferRinger';

// A oferta da roleta toca o Chegou na hora e de 10 em 10 s até o corretor
// responder (Som do Plantão, 11/11/2026). Só a aba líder toca.
describe('useOfferRinger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playLeadAlert.mockClear();
    lider = true;
  });
  afterEach(() => vi.useRealTimers());

  it('repete a cada 10 s', () => {
    expect(RING_MS).toBe(10_000);
    renderHook(() => useOfferRinger(true));
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(3);
  });

  it('para quando a oferta deixa de tocar', () => {
    const { rerender } = renderHook(({ ringing }) => useOfferRinger(ringing), { initialProps: { ringing: true } });
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
    rerender({ ringing: false });
    vi.advanceTimersByTime(60_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
  });

  it('não toca sem oferta', () => {
    renderHook(() => useOfferRinger(false));
    vi.advanceTimersByTime(30_000);
    expect(playLeadAlert).not.toHaveBeenCalled();
  });

  it('para sozinho quando o prazo vence, sem esperar a tela se redesenhar', () => {
    renderHook(() => useOfferRinger(true, Date.now() + 15_000));
    vi.advanceTimersByTime(10_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(2);
  });

  it('aba que não é a líder não toca', () => {
    lider = false;
    renderHook(() => useOfferRinger(true));
    vi.advanceTimersByTime(30_000);
    expect(playLeadAlert).not.toHaveBeenCalled();
  });

  it('aba que vira líder no meio começa a tocar no próximo ciclo', () => {
    lider = false;
    renderHook(() => useOfferRinger(true));
    lider = true;
    vi.advanceTimersByTime(10_000);
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
  });
});
