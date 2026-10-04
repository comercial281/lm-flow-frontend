import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ openCount: vi.fn() }));
vi.mock('@/services/support/supportAdminService', () => ({ supportAdminService: svc }));

import { useChamadosAbertos } from './useChamadosAbertos';

describe('useChamadosAbertos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.openCount.mockResolvedValue(3);
  });

  it('ativo: busca o número', async () => {
    const { result } = renderHook(() => useChamadosAbertos(true));
    await waitFor(() => expect(result.current).toBe(3));
  });

  it('inativo: nenhuma requisição', () => {
    const { result } = renderHook(() => useChamadosAbertos(false));
    expect(svc.openCount).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});
