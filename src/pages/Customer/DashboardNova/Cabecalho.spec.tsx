// src/pages/Customer/DashboardNova/Cabecalho.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../DashboardV2/components/InstancePicker', () => ({ InstancePicker: () => null }));
vi.mock('../DashboardV2/components/TagPicker', () => ({ TagPicker: () => null }));
vi.mock('../DashboardV2/components/AiToggle', () => ({ AiToggle: () => null }));
vi.mock('@/services/users', () => ({
  usersService: { getUsers: vi.fn().mockResolvedValue({ data: [{ id: 'u1', name: 'Ana' }] }) },
}));

import { Cabecalho } from './Cabecalho';
import type { FiltrosDashboard, ScopeInfoNova } from './types';

const escopo = (
  modes: ('mine' | 'team' | 'all')[], mode: 'mine' | 'team' | 'all', locked = false, owner_id: string | null = null,
): ScopeInfoNova => ({
  mode, locked, available_modes: modes, blocks: { media_spend: false, operations: false }, owner_id,
});

describe('Cabecalho', () => {
  it('mostra a visão como botões, com os modos que o servidor oferece', () => {
    const onFiltros = vi.fn();
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all', 'mine'], 'all')}
        filtros={{ preset: 'last_7_days' }} onFiltros={onFiltros} />,
    );
    expect(screen.getByRole('button', { name: 'Imobiliária' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Meu time' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Só os meus' }));
    expect(onFiltros).toHaveBeenCalledWith({ preset: 'last_7_days', scope: 'mine' });
  });

  it('o corretor travado não vê o seletor de visão', () => {
    render(
      <Cabecalho nome="Ana" subtitulo="" visao="corretor" scope={escopo(['mine'], 'mine', true)}
        filtros={{ preset: 'last_7_days' }} onFiltros={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Só os meus' })).not.toBeInTheDocument();
  });

  it('um período só, com 7 dias de padrão', () => {
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all'], 'all')}
        filtros={{ preset: 'last_7_days' }} onFiltros={vi.fn()} />,
    );
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveValue('last_7_days');
    expect(screen.getByRole('option', { name: 'Últimos 7 dias' })).toBeInTheDocument();
  });

  it('Filtros mostra quantos estão ativos e abre o painel', async () => {
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all'], 'all')}
        filtros={{ preset: 'last_7_days', inboxId: 'i1', aiOnly: true }} onFiltros={vi.fn()} />,
    );
    const botao = screen.getByRole('button', { name: /Filtros/ });
    expect(botao).toHaveTextContent('2');
    fireEvent.click(botao);
    expect(screen.getByRole('region', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument();
  });

  it('Corretor só aparece na visão gestor', () => {
    render(
      <Cabecalho nome="Ana" subtitulo="" visao="corretor" scope={escopo(['mine'], 'mine', true)}
        filtros={{ preset: 'last_7_days' }} onFiltros={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.queryByRole('combobox', { name: 'Corretor' })).not.toBeInTheDocument();
  });

  it('Limpar filtros mantém só o período e a visão', async () => {
    const onFiltros = vi.fn();
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all', 'team'], 'team')}
        filtros={{ preset: 'last_30_days', scope: 'team', inboxId: 'i1', labelId: 'l1', aiOnly: true }}
        onFiltros={onFiltros} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    await screen.findByRole('option', { name: 'Ana' });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onFiltros).toHaveBeenCalledWith({ preset: 'last_30_days', scope: 'team' });
  });

  it('o Corretor mostra o que o servidor aplicou, não só o que foi escolhido', async () => {
    // O servidor descarta um corretor fora do time sem avisar: scope.owner_id volta null.
    const filtros: FiltrosDashboard = { preset: 'last_7_days', ownerId: 'fora-do-time' };
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all'], 'all', false, null)}
        filtros={filtros} onFiltros={vi.fn()} />,
    );
    const botao = screen.getByRole('button', { name: /Filtros/ });
    expect(botao).not.toHaveTextContent(/\d/);
    fireEvent.click(botao);
    await screen.findByRole('option', { name: 'Ana' });
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('');
  });

  it('o Corretor aceito pelo servidor aparece escolhido e conta como filtro', async () => {
    render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all'], 'all', false, 'u1')}
        filtros={{ preset: 'last_7_days', ownerId: 'u1' }} onFiltros={vi.fn()} />,
    );
    const botao = screen.getByRole('button', { name: /Filtros/ });
    expect(botao).toHaveTextContent('1');
    fireEvent.click(botao);
    await screen.findByRole('option', { name: 'Ana' });
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('u1');
  });

  it('enquanto o servidor não responde, o Corretor mostra o que acabou de ser escolhido', async () => {
    const onFiltros = vi.fn();
    const scope = escopo(['all'], 'all', false, null);
    const { rerender } = render(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={scope}
        filtros={{ preset: 'last_7_days' }} onFiltros={onFiltros} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    await screen.findByRole('option', { name: 'Ana' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Corretor' }), { target: { value: 'u1' } });
    expect(onFiltros).toHaveBeenCalledWith({ preset: 'last_7_days', ownerId: 'u1' });

    // Mesma resposta de antes (o pedido novo ainda não voltou): vale a escolha.
    rerender(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={scope}
        filtros={{ preset: 'last_7_days', ownerId: 'u1' }} onFiltros={onFiltros} />,
    );
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('u1');

    // A resposta nova chegou e o servidor descartou: vale o servidor.
    rerender(
      <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={escopo(['all'], 'all', false, null)}
        filtros={{ preset: 'last_7_days', ownerId: 'u1' }} onFiltros={onFiltros} />,
    );
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('');
  });
});
