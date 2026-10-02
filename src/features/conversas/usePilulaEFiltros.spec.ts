import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { BaseFilter } from '@/types/core';
import { usePilulaEFiltros } from './usePilulaEFiltros';

const f = (attributeKey: string, values: string): BaseFilter => ({
  attributeKey, filterOperator: 'equal_to', values, queryOperator: 'and', attributeModel: 'standard',
});
const aberta = f('status', 'open');
const resp42 = f('assignee_id', '42');

describe('usePilulaEFiltros', () => {
  it('Todas (responsável 42) -> Minhas -> Todas devolve o 42', () => {
    const { result } = renderHook(() => usePilulaEFiltros([aberta, resp42]));

    act(() => result.current.setPilula('minhas'));
    expect(result.current.filtrosAplicados('7').filter((x) => x.attributeKey === 'assignee_id')).toEqual([
      f('assignee_id', '7'),
    ]);
    expect(result.current.filtrosDoPopover).toEqual([aberta, resp42]);

    act(() => result.current.setPilula('todas'));
    expect(result.current.filtrosAplicados('7')).toEqual([aberta, resp42]);
  });

  it('a pílula e os filtros sobrevivem a um novo render do consumidor (remonte da lista)', () => {
    const { result, rerender } = renderHook(() => usePilulaEFiltros([aberta]));
    act(() => result.current.setPilula('sem_resposta'));
    rerender();
    expect(result.current.pilula).toBe('sem_resposta');
    expect(result.current.filtrosAplicados()).toEqual([aberta, f('waiting', 'true')]);
  });

  it('escolher responsável no popover durante Minhas não vaza pra pílula', () => {
    const { result } = renderHook(() => usePilulaEFiltros([aberta]));
    act(() => result.current.setPilula('minhas'));
    act(() => result.current.setFiltrosDoPopover([aberta, resp42]));
    act(() => result.current.setPilula('todas'));
    expect(result.current.filtrosAplicados('7')).toEqual([aberta, resp42]);
  });
});
