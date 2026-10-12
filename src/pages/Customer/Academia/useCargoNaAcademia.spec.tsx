import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({ suporte: false, gestor: false }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => m.suporte }));
vi.mock('@/features/tarefas/useEhGestor', () => ({ useEhGestor: () => m.gestor }));

import { useCargoNaAcademia } from './useCargoNaAcademia';
import { definirVerComo } from './verComo';
import BarraDaLealMidia from './BarraDaLealMidia';

beforeEach(() => {
  m.suporte = false;
  m.gestor = false;
  act(() => definirVerComo(null));
});

describe('useCargoNaAcademia', () => {
  it('sem permissão de ver a equipe (ou ainda carregando) é corretor', () => {
    const { result } = renderHook(() => useCargoNaAcademia());
    expect(result.current).toEqual({ cargo: 'corretor', podeEditar: false, ehLealMidia: false });
  });

  it('quem vê a equipe toda é gestor', () => {
    m.gestor = true;
    const { result } = renderHook(() => useCargoNaAcademia());
    expect(result.current.cargo).toBe('gestor');
  });

  it('Leal Mídia é admin e edita; em Ver como Corretor vira corretor e não edita', () => {
    m.suporte = true;
    const { result } = renderHook(() => useCargoNaAcademia());
    expect(result.current).toEqual({ cargo: 'admin', podeEditar: true, ehLealMidia: true });
    act(() => definirVerComo('corretor'));
    expect(result.current).toEqual({ cargo: 'corretor', podeEditar: false, ehLealMidia: true });
    act(() => definirVerComo('admin'));
    expect(result.current.podeEditar).toBe(true);
  });

  it('Ver como de quem não é Leal Mídia é ignorado', () => {
    act(() => definirVerComo('admin'));
    const { result } = renderHook(() => useCargoNaAcademia());
    expect(result.current.cargo).toBe('corretor');
  });
});

describe('BarraDaLealMidia', () => {
  it('não aparece pra quem não é Leal Mídia', () => {
    render(<BarraDaLealMidia><button type="button">Novo curso</button></BarraDaLealMidia>);
    expect(screen.queryByRole('radiogroup', { name: 'Ver como' })).toBeNull();
  });

  it('troca o Ver como e esconde as ações fora de Administrador', async () => {
    m.suporte = true;
    render(<BarraDaLealMidia><button type="button">Novo curso</button></BarraDaLealMidia>);
    expect(screen.getByRole('button', { name: 'Novo curso' })).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Corretor' }));
    expect(screen.queryByRole('button', { name: 'Novo curso' })).toBeNull();
  });
});
