// src/pages/Customer/DashboardNova/ListaRapida.fechando.spec.tsx
// O painel desliza para fora depois de fechar: durante esse tempo o conteúdo
// ainda está na tela. Aqui o Sheet desenha o conteúdo mesmo fechado, para ver
// o que aparece nesse meio-tempo (o Sheet de verdade, no jsdom, some na hora).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ListaKind, ListaRapidaPayload } from './types';
import type { PodeAbrir } from './usePodeAbrir';

const fetchList = vi.fn();
vi.mock('@/services/dashboard/dashboardMetricsService', () => ({ fetchDashboardList: (...a: unknown[]) => fetchList(...a) }));
vi.mock('@/components/ui/ds', () => {
  const Passa: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  return { Sheet: Passa, SheetContent: Passa, SheetHeader: Passa, SheetTitle: Passa, SheetDescription: Passa };
});

import { ListaRapida } from './ListaRapida';

const TUDO: PodeAbrir = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };

const payload = (kind: ListaKind, nome: string): ListaRapidaPayload => ({
  kind, total: 1, items: [{ id: nome, title: nome, subtitle: null, owner_name: null, since: null, open: { type: 'conversation', id: nome } }],
});

const tela = (aberta: boolean, preset: 'last_7_days' | 'last_30_days' = 'last_7_days') => (
  <MemoryRouter>
    <ListaRapida aberta={aberta} kind="sem_responsavel" titulo="Leads sem responsável" pode={TUDO}
      filtros={{ preset }} onFechar={vi.fn()} />
  </MemoryRouter>
);

describe('ListaRapida fechando', () => {
  beforeEach(() => { fetchList.mockReset(); });

  it('fechar não apaga a lista enquanto o painel desliza para fora', async () => {
    fetchList.mockResolvedValue(payload('sem_responsavel', 'Fulano'));
    const { rerender } = render(tela(true));
    await waitFor(() => screen.getByText('Fulano'));

    rerender(tela(false));
    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('filtro que muda com o painel fechado não busca; reabrir busca de novo', async () => {
    fetchList.mockResolvedValue(payload('sem_responsavel', 'Fulano'));
    const { rerender } = render(tela(true));
    await waitFor(() => screen.getByText('Fulano'));

    rerender(tela(false));
    rerender(tela(false, 'last_30_days'));
    expect(fetchList).toHaveBeenCalledTimes(1);

    fetchList.mockResolvedValue(payload('sem_responsavel', 'Beltrano'));
    rerender(tela(true, 'last_30_days'));
    await waitFor(() => screen.getByText('Beltrano'));
    expect(fetchList).toHaveBeenCalledTimes(2);
    expect(fetchList).toHaveBeenLastCalledWith('sem_responsavel', { preset: 'last_30_days' });
  });
});
