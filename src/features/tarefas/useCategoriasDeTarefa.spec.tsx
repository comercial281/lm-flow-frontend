import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list } }));

import { useCategoriasDeTarefa } from './useCategoriasDeTarefa';

const op = (id: string, label: string, position: number, active = true) => ({ id, list_key: 'task_categories', label, position, active, meta_exclusion: false });

describe('useCategoriasDeTarefa', () => {
  it('lê a lista com as arquivadas; ativas na ordem, todas inteiras', async () => {
    list.mockResolvedValue([op('b', 'Segunda', 1), op('x', 'Velha', 2, false), op('a', 'Primeira', 0)]);
    const { result } = renderHook(() => useCategoriasDeTarefa());
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(list).toHaveBeenCalledWith('task_categories', { includeInactive: true });
    expect(result.current.ativas.map(o => o.id)).toEqual(['a', 'b']);
    expect(result.current.todas).toHaveLength(3);
  });

  it('falha de leitura: listas vazias, sem quebrar', async () => {
    list.mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useCategoriasDeTarefa());
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativas).toEqual([]);
    expect(result.current.todas).toEqual([]);
  });
});
