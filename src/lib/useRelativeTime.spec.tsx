import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRelativeTime } from './useRelativeTime';

const FIXED_NOW = new Date('2026-05-20T13:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRelativeTime', () => {
  it('returns the current time on first render', () => {
    const { result } = renderHook(() => useRelativeTime(new Date(FIXED_NOW.getTime() - 10_000)));
    expect(result.current.getTime()).toBe(FIXED_NOW.getTime());
  });

  it('ticks every 5s when the date is fresher than 1 minute', () => {
    const date = new Date(FIXED_NOW.getTime() - 10_000);
    const { result } = renderHook(() => useRelativeTime(date));
    const initial = result.current.getTime();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.getTime()).toBe(initial + 5_000);
  });

  it('ticks every 30s when the date is between 1m and 1h old', () => {
    const date = new Date(FIXED_NOW.getTime() - 5 * 60 * 1000);
    const { result } = renderHook(() => useRelativeTime(date));
    const initial = result.current.getTime();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.getTime()).toBe(initial);
    act(() => {
      vi.advanceTimersByTime(25_000);
    });
    expect(result.current.getTime()).toBe(initial + 30_000);
  });

  it('does not start the interval when date is null', () => {
    const { result } = renderHook(() => useRelativeTime(null));
    const initial = result.current.getTime();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.getTime()).toBe(initial);
  });
});
