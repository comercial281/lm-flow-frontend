import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { FlowNodeCard, type FlowNodeCardData } from './FlowNodeCard';

// Organizar (29/10/2026): o que segue o caminho sai pela direita, o desvio sai
// por baixo, e a linha pode entrar no bloco pela esquerda ou por cima.

const bloco = (over: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: 0, pos_y: 0, steps: [], ...over,
});

function renderCard(node: FlowAutomationNode) {
  const data: FlowNodeCardData = {
    node, lookups: { stageName: () => undefined, actionSummary: () => '' } as unknown as FlowNodeCardData['lookups'],
    onEdit: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(), onRename: vi.fn(),
  };
  return render(
    <ReactFlowProvider>
      <FlowNodeCard {...({ id: node.id, data, selected: false } as never)} />
    </ReactFlowProvider>,
  );
}

const lado = (container: HTMLElement, handleId: string) =>
  container.querySelector(`.react-flow__handle[data-handleid="${handleId}"]`)?.getAttribute('data-handlepos') ?? null;

describe('saídas do cartão', () => {
  it('condição: Sim pela direita, Não por baixo', () => {
    const { container } = renderCard(bloco({ kind: 'condition' }));
    expect(lado(container, 'yes')).toBe('right');
    expect(lado(container, 'no')).toBe('bottom');
  });

  it('espera com prazo: Não respondeu pela direita, Respondeu por baixo', () => {
    const { container } = renderCard(bloco({ kind: 'wait_for_reply', config: { minutes: 60 } }));
    expect(lado(container, 'no')).toBe('right');
    expect(lado(container, 'yes')).toBe('bottom');
  });

  it('a linha entra pela esquerda ou por cima', () => {
    const { container } = renderCard(bloco({}));
    expect(lado(container, 'in')).toBe('left');
    expect(lado(container, 'in-top')).toBe('top');
  });
});
