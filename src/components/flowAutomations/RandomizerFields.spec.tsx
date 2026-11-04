import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { RandomizerFields } from './RandomizerFields';
import { FlowNodeCard, type FlowNodeCardData } from './FlowNodeCard';

function Janela({ start }: { start: FlowNodeConfig }) {
  const [config, setConfig] = useState(start);
  return <RandomizerFields config={config} onChange={setConfig} />;
}

const dois: FlowNodeConfig = { branches: [{ id: 'a', percent: 50, next_node_id: 'x' }, { id: 'b', percent: 50, next_node_id: null }] };

describe('janela do Randomizador', () => {
  it('mostra um campo de % por caminho, com a letra', () => {
    render(<Janela start={dois} />);
    expect(screen.getByLabelText('% do Caminho A')).toHaveValue(50);
    expect(screen.getByLabelText('% do Caminho B')).toHaveValue(50);
    expect(screen.getByText('Total: 100%')).toBeInTheDocument();
  });

  it('adicionar caminho redivide igual', () => {
    render(<Janela start={dois} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar caminho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar caminho' }));
    ['A', 'B', 'C', 'D'].forEach(letra => expect(screen.getByLabelText(`% do Caminho ${letra}`)).toHaveValue(25));
  });

  it('digitar uma % avisa quanto falta e "Dividir igual" acerta', () => {
    render(<Janela start={dois} />);
    fireEvent.change(screen.getByLabelText('% do Caminho A'), { target: { value: '30' } });
    expect(screen.getByRole('status')).toHaveTextContent('Faltam 20% pra fechar 100%.');
    fireEvent.click(screen.getByRole('button', { name: 'Dividir igual' }));
    expect(screen.getByLabelText('% do Caminho A')).toHaveValue(50);
    expect(screen.getByText('Total: 100%')).toBeInTheDocument();
  });

  it('o total mora na mesma caixa com a soma certa ou errada: a janela não muda de altura enquanto digita', () => {
    render(<Janela start={dois} />);
    const caixa = () => screen.getByTestId('total-dos-caminhos');
    expect(caixa()).toHaveTextContent('Total: 100%');
    const antes = caixa();
    fireEvent.change(screen.getByLabelText('% do Caminho A'), { target: { value: '30' } });
    expect(caixa()).toBe(antes);
    expect(caixa()).toHaveTextContent('Total: 80%. Faltam 20% pra fechar 100%.');
  });

  it('com 2 caminhos não tem remover; com 3, sim', () => {
    render(<Janela start={dois} />);
    expect(screen.queryByRole('button', { name: 'Remover Caminho A' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar caminho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Caminho A' }));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('em 10 caminhos o botão de adicionar trava', () => {
    const dez: FlowNodeConfig = { branches: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, percent: 10, next_node_id: null })) };
    render(<Janela start={dez} />);
    expect(screen.getByRole('button', { name: 'Adicionar caminho' })).toBeDisabled();
  });

  it('diz o que acontece no caminho vazio', () => {
    render(<Janela start={dois} />);
    expect(screen.getByText(/Sem nada ligado num caminho, o fluxo para aqui/)).toBeInTheDocument();
  });

  it('no modo guiado a % só aparece, sem editar', () => {
    render(<RandomizerFields config={dois} onChange={vi.fn()} readOnly />);
    expect(screen.getByLabelText('% do Caminho A')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Adicionar caminho' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dividir igual' })).toBeNull();
  });
});

describe('cartão do Randomizador no mapa', () => {
  const bloco: FlowAutomationNode = {
    id: 'r', kind: 'randomizer', label: null, config: { branches: [{ id: 'a', percent: 25, next_node_id: 'x' }, { id: 'b', percent: 75, next_node_id: null }] },
    next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 0, steps: [],
  };

  function renderCard(over: Partial<FlowNodeCardData> = {}) {
    const data: FlowNodeCardData = {
      node: bloco, lookups: {} as FlowNodeCardData['lookups'],
      onEdit: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(), onRename: vi.fn(), ...over,
    };
    const view = render(
      <ReactFlowProvider>
        <FlowNodeCard {...({ id: bloco.id, data, selected: false } as never)} />
      </ReactFlowProvider>,
    );
    return { ...view, data };
  }

  it('uma linha por caminho com letra e %, e um ponto de saída em cada', () => {
    const { container } = renderCard();
    const linhas = screen.getByRole('list', { name: 'Caminhos do sorteio' });
    expect(within(linhas).getAllByRole('listitem')).toHaveLength(2);
    expect(within(linhas).getByText('25%')).toBeInTheDocument();
    expect(within(linhas).getByText('75%')).toBeInTheDocument();
    expect(container.querySelector('[data-handleid="path:a"]')?.getAttribute('data-handlepos')).toBe('right');
    expect(container.querySelector('[data-handleid="path:b"]')?.getAttribute('data-handlepos')).toBe('right');
    expect(screen.getByText('Sorteia 1 de 2 caminhos pra cada lead.')).toBeInTheDocument();
  });

  it('o "+" do caminho pede o bloco naquela saída, sem abrir a janela', () => {
    const { data } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Pôr um bloco no Caminho B' }));
    expect(data.onAddFrom).toHaveBeenCalledWith('r', 'path:b');
    expect(data.onEdit).not.toHaveBeenCalled();
  });

  it('sem poder adicionar, some o "+" e fica a %', () => {
    renderCard({ allow: { edit: false, duplicate: false, remove: false, add: false, rename: false } });
    expect(screen.queryByRole('button', { name: /Pôr um bloco/ })).toBeNull();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});
