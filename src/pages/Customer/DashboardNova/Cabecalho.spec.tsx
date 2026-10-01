// src/pages/Customer/DashboardNova/Cabecalho.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../DashboardV2/components/InstancePicker', () => ({ InstancePicker: () => null }));
vi.mock('../DashboardV2/components/TagPicker', () => ({ TagPicker: () => null }));
vi.mock('../DashboardV2/components/AiToggle', () => ({ AiToggle: () => null }));
vi.mock('@/services/users', () => ({
  usersService: { getUsers: vi.fn().mockResolvedValue({ data: [{ id: 'u1', name: 'Ana' }, { id: 'u9', name: 'Bruno' }] }) },
}));

import { Cabecalho } from './Cabecalho';
import type { FiltrosDashboard, ScopeInfoNova } from './types';

const escopo = (
  modes: ('mine' | 'team' | 'all')[], mode: 'mine' | 'team' | 'all', locked = false, owner_id: string | null = null,
): ScopeInfoNova => ({
  mode, locked, available_modes: modes, blocks: { media_spend: false, operations: false }, owner_id,
});

const gestor = (props: {
  scope?: ScopeInfoNova; carregando?: boolean; filtros: FiltrosDashboard; onFiltros?: (f: FiltrosDashboard) => void;
}) => (
  <Cabecalho nome="Rafael" subtitulo="" visao="gestor" scope={props.scope ?? escopo(['all'], 'all')}
    carregando={props.carregando ?? false} filtros={props.filtros} onFiltros={props.onFiltros ?? vi.fn()} />
);

const abrirFiltros = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
  await screen.findByRole('option', { name: 'Ana' });
};

describe('Cabecalho', () => {
  it('mostra a visão como botões, com os modos que o servidor oferece', () => {
    const onFiltros = vi.fn();
    render(gestor({ scope: escopo(['all', 'mine'], 'all'), filtros: { preset: 'last_7_days' }, onFiltros }));
    expect(screen.getByRole('button', { name: 'Imobiliária' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Meu time' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Só os meus' }));
    expect(onFiltros).toHaveBeenCalledWith({ preset: 'last_7_days', scope: 'mine' });
  });

  it('o corretor travado não vê o seletor de visão', () => {
    render(
      <Cabecalho nome="Ana" subtitulo="" visao="corretor" scope={escopo(['mine'], 'mine', true)} carregando={false}
        filtros={{ preset: 'last_7_days' }} onFiltros={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Só os meus' })).not.toBeInTheDocument();
  });

  it('um período só, com 7 dias de padrão', () => {
    render(gestor({ filtros: { preset: 'last_7_days' } }));
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveValue('last_7_days');
    expect(screen.getByRole('option', { name: 'Últimos 7 dias' })).toBeInTheDocument();
  });

  it('Filtros mostra quantos estão ativos e abre o painel que ele controla', async () => {
    render(gestor({ filtros: { preset: 'last_7_days', inboxId: 'i1', aiOnly: true } }));
    const botao = screen.getByRole('button', { name: /Filtros/ });
    expect(botao).toHaveTextContent('2');
    await abrirFiltros();
    const painel = screen.getByRole('region', { name: 'Filtros' });
    expect(botao).toHaveAttribute('aria-controls', painel.id);
    expect(painel.id).not.toBe('');
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('Corretor só aparece na visão gestor', () => {
    render(
      <Cabecalho nome="Ana" subtitulo="" visao="corretor" scope={escopo(['mine'], 'mine', true)} carregando={false}
        filtros={{ preset: 'last_7_days' }} onFiltros={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.queryByRole('combobox', { name: 'Corretor' })).not.toBeInTheDocument();
  });

  it('Limpar filtros mantém o período, a visão e o funil', async () => {
    const onFiltros = vi.fn();
    render(gestor({
      scope: escopo(['all', 'team'], 'team', false, 'u1'),
      filtros: {
        preset: 'last_30_days', scope: 'team', pipelineId: 'p1', ownerId: 'u1', inboxId: 'i1', labelId: 'l1',
        aiOnly: true, salesAgentId: 'a1',
      },
      onFiltros,
    }));
    await abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onFiltros).toHaveBeenLastCalledWith({ preset: 'last_30_days', scope: 'team', pipelineId: 'p1' });
  });

  it('o Corretor aceito pelo servidor aparece escolhido e conta como filtro', async () => {
    render(gestor({ scope: escopo(['all'], 'all', false, 'u1'), filtros: { preset: 'last_7_days', ownerId: 'u1' } }));
    const botao = screen.getByRole('button', { name: /Filtros/ });
    expect(botao).toHaveTextContent('1');
    await abrirFiltros();
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('u1');
  });

  it('enquanto carrega, o Corretor mostra o que acabou de ser escolhido', async () => {
    const onFiltros = vi.fn();
    const { rerender } = render(gestor({ filtros: { preset: 'last_7_days' }, onFiltros }));
    await abrirFiltros();
    fireEvent.change(screen.getByRole('combobox', { name: 'Corretor' }), { target: { value: 'u1' } });
    expect(onFiltros).toHaveBeenCalledWith({ preset: 'last_7_days', ownerId: 'u1' });

    rerender(gestor({ carregando: true, filtros: { preset: 'last_7_days', ownerId: 'u1' }, onFiltros }));
    expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('u1');
    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveTextContent('1');
    // Ainda carregando: nada de limpar a escolha.
    expect(onFiltros).toHaveBeenCalledTimes(1);
  });

  it('logo depois de escolher, antes do carregando virar true, a escolha não é apagada', () => {
    const onFiltros = vi.fn();
    const scope = escopo(['all'], 'all', false, null);
    const { rerender } = render(gestor({ scope, filtros: { preset: 'last_7_days' }, onFiltros }));
    // A página já trocou o filtro, mas o pedido novo ainda não começou: mesma resposta, carregando false.
    rerender(gestor({ scope, filtros: { preset: 'last_7_days', ownerId: 'u9' }, onFiltros }));
    expect(onFiltros).not.toHaveBeenCalled();
  });

  it('corretor descartado pelo servidor volta para Todos e sai dos filtros, mesmo escolhido de novo', async () => {
    const onFiltros = vi.fn();
    const { rerender } = render(gestor({ filtros: { preset: 'last_7_days' }, onFiltros }));
    await abrirFiltros();

    for (let vez = 1; vez <= 2; vez++) {
      fireEvent.change(screen.getByRole('combobox', { name: 'Corretor' }), { target: { value: 'u9' } });
      expect(onFiltros).toHaveBeenLastCalledWith({ preset: 'last_7_days', ownerId: 'u9' });
      rerender(gestor({ carregando: true, filtros: { preset: 'last_7_days', ownerId: 'u9' }, onFiltros }));
      expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('u9');

      // A resposta chegou e o servidor descartou (scope.owner_id null).
      rerender(gestor({
        scope: escopo(['all'], 'all', false, null), filtros: { preset: 'last_7_days', ownerId: 'u9' }, onFiltros,
      }));
      expect(screen.getByRole('combobox', { name: 'Corretor' })).toHaveValue('');
      expect(screen.getByRole('button', { name: /Filtros/ })).not.toHaveTextContent(/\d/);
      expect(onFiltros).toHaveBeenLastCalledWith({ preset: 'last_7_days', ownerId: undefined });
      rerender(gestor({ scope: escopo(['all'], 'all', false, null), filtros: { preset: 'last_7_days' }, onFiltros }));
    }
    // 2 escolhas + 2 limpezas, sem laço.
    expect(onFiltros).toHaveBeenCalledTimes(4);
  });

  it('pedido que falha (mesma resposta, carregando volta a false) não apaga a escolha', () => {
    const onFiltros = vi.fn();
    const scope = escopo(['all'], 'all', false, null);
    const { rerender } = render(gestor({ scope, filtros: { preset: 'last_7_days' }, onFiltros }));
    rerender(gestor({ scope, carregando: true, filtros: { preset: 'last_7_days', ownerId: 'u9' }, onFiltros }));
    rerender(gestor({ scope, carregando: false, filtros: { preset: 'last_7_days', ownerId: 'u9' }, onFiltros }));
    expect(onFiltros).not.toHaveBeenCalled();
  });
});
