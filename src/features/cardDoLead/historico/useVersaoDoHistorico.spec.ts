// src/features/cardDoLead/historico/useVersaoDoHistorico.spec.ts
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { EVENTO_TAREFAS_MUDARAM } from '@/features/tarefas/tarefasService';
import { useVersaoDoHistorico } from './useVersaoDoHistorico';

describe('useVersaoDoHistorico', () => {
  it('muda com o pedido de recarga e com etapa, situação ou responsável do card; objeto novo igual não muda', () => {
    const item = { stage_id: 's1', status: 'open', assignee: { id: 'u1', name: 'Ana' } } as never;
    const { result, rerender } = renderHook(({ i }) => useVersaoDoHistorico(i), { initialProps: { i: item } });
    const v0 = result.current.versaoHistorico;

    act(() => result.current.recarregarHistorico());
    const v1 = result.current.versaoHistorico;
    expect(v1).not.toBe(v0);

    rerender({ i: { stage_id: 's1', status: 'lost', assignee: { id: 'u1', name: 'Ana' } } as never });
    const v2 = result.current.versaoHistorico;
    expect(v2).not.toBe(v1);

    rerender({ i: { stage_id: 's1', status: 'lost', assignee: { id: 'u1', name: 'Ana' } } as never });
    expect(result.current.versaoHistorico).toBe(v2);

    rerender({ i: { stage_id: 's2', status: 'lost', assignee: { id: 'u2', name: 'Bruno' } } as never });
    expect(result.current.versaoHistorico).not.toBe(v2);
  });

  it('aguenta card nulo (página ainda carregando)', () => {
    const { result } = renderHook(() => useVersaoDoHistorico(null));

    expect(typeof result.current.versaoHistorico).toBe('string');
  });

  it('muda quando a sessão de Tarefas avisa que uma tarefa mudou (criar, concluir, reabrir)', () => {
    const item = { stage_id: 's1', status: 'open', assignee: { id: 'u1', name: 'Ana' } } as never;
    const { result, unmount } = renderHook(() => useVersaoDoHistorico(item));
    const v0 = result.current.versaoHistorico;

    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_TAREFAS_MUDARAM));
    });
    expect(result.current.versaoHistorico).not.toBe(v0);

    unmount();
  });
});
