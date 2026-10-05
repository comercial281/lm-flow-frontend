import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import IaBarra, { type IaBarraProps } from './IaBarra';

// As listas suspensas são Radix: abrem no pointerdown, que o fireEvent.click do
// jsdom não produz. O userEvent simula o ponteiro inteiro (mesmo padrão do Meu site).

const ia = (id: string, name: string, extra: Partial<SalesAgent> = {}) =>
  ({ id, name, enabled: true, inbox_id: 'inbox-1', triggers: [], trigger_keyword: null, trigger_match_mode: 'any', ...extra }) as SalesAgent;

const VENDAS = ia('ia-1', 'IA de Vendas');
const DEMO = ia('ia-2', 'IA Demo', { inbox_id: null });

function abrir(extra: Partial<IaBarraProps> = {}) {
  const props: IaBarraProps = {
    agents: [VENDAS, DEMO], selecionada: VENDAS, situacao: { tipo: 'atendendo', frase: 'Atendendo' },
    tela: 'visao-geral', insights: true, podeCriar: true, podeExcluir: true,
    aoIr: vi.fn(), aoTrocarIa: vi.fn(), aoCriar: vi.fn(), aoDuplicar: vi.fn(), aoExcluir: vi.fn(),
    ...extra,
  };
  render(<IaBarra {...props} />);
  return props;
}

describe('IaBarra', () => {
  it('mostra a IA aberta e o selo com a frase inteira', () => {
    abrir({ situacao: { tipo: 'parada', frase: 'Parada: falta o número' } });
    expect(screen.getByRole('button', { name: /IA de Vendas/ })).toBeInTheDocument();
    expect(screen.getByText('Parada: falta o número')).toBeInTheDocument();
  });

  it('o seletor troca de IA e mostra o veredito de cada uma', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    const demo = await screen.findByRole('menuitem', { name: /IA Demo/ });
    expect(within(demo).getByRole('status')).toHaveTextContent('Parada');
    await userEvent.click(demo);
    expect(props.aoTrocarIa).toHaveBeenCalledWith('ia-2');
  });

  it('"Nova IA" fica no seletor, só pra quem pode criar', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Nova IA' }));
    expect(props.aoCriar).toHaveBeenCalled();
  });

  it('sem permissão de criar, não há "Nova IA"', async () => {
    abrir({ podeCriar: false });
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await screen.findByRole('menuitem', { name: /IA Demo/ });
    expect(screen.queryByRole('menuitem', { name: 'Nova IA' })).toBeNull();
  });

  it('Painel abre Visão geral, Sugestões e Relatório semanal', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Painel/ }));
    expect(await screen.findByRole('menuitem', { name: /Visão geral/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Relatório semanal/ }));
    expect(props.aoIr).toHaveBeenCalledWith('relatorio-semanal');
  });

  it('sem a chave de sugestões, Painel vira botão direto pra Visão geral', async () => {
    const props = abrir({ insights: false, tela: 'ensinar' });
    await userEvent.click(screen.getByRole('button', { name: 'Painel' }));
    expect(props.aoIr).toHaveBeenCalledWith('visao-geral');
    expect(screen.queryByRole('menuitem', { name: /Sugestões/ })).toBeNull();
  });

  it('Configurar, Ensinar, Testar e Diagnóstico navegam direto', async () => {
    const props = abrir();
    for (const [rotulo, tela] of [['Configurar', 'configurar'], ['Ensinar', 'ensinar'], ['Testar', 'testar'], ['Diagnóstico', 'diagnostico']]) {
      await userEvent.click(screen.getByRole('button', { name: rotulo }));
      expect(props.aoIr).toHaveBeenLastCalledWith(tela);
    }
  });

  it('Duplicar e Excluir ficam em "Mais ações"', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Excluir IA/ }));
    expect(props.aoExcluir).toHaveBeenCalled();
  });

  it('sem IA nenhuma, só o seletor (com Nova IA), sem menus', () => {
    abrir({ agents: [], selecionada: null, situacao: null });
    expect(screen.queryByRole('navigation', { name: 'Menu da IA Vendedora' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull();
  });
});
