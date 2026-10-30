// Construtor no Vidro violeta (spec 2026-10-30-vidro-violeta-telas-design.md).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { blockGroup } from '@/features/flowAutomations/palette';
import { FlowNodeCard, FlowStartNode, type FlowNodeCardData } from './FlowNodeCard';

const msg = (over: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: { message: 'Oi' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: 0, pos_y: 0, steps: [], ...over,
});

function renderCard(node: FlowAutomationNode, extra: { selected?: boolean; problem?: string | null } = {}) {
  const data: FlowNodeCardData = {
    node, lookups: {} as FlowNodeCardData['lookups'], problem: extra.problem ?? null,
    onEdit: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(), onRename: vi.fn(),
  };
  return render(
    <ReactFlowProvider>
      <FlowNodeCard {...({ id: node.id, data, selected: !!extra.selected } as never)} />
    </ReactFlowProvider>,
  );
}

/** A cor como o jsdom devolve no style (rgb). */
const corNoStyle = (hex: string) => {
  const d = document.createElement('div');
  d.style.backgroundColor = hex;
  return d.style.backgroundColor;
};

describe('bloco do construtor no Vidro violeta', () => {
  it('o bloco usa a classe do construtor e mantém a cor do grupo na faixa', () => {
    const node = msg();
    const { container } = renderCard(node);
    expect(container.querySelector('[data-guide], .fluxo-bloco')).toHaveClass('fluxo-bloco');
    const faixa = container.querySelector('.fluxo-faixa') as HTMLElement;
    expect(faixa).not.toBeNull();
    expect(faixa.style.backgroundColor).toBe(corNoStyle(nodeColor(node.kind, blockGroup(node))));
  });

  it('selecionado marca data-selecionado; sem seleção, não', () => {
    const { container, unmount } = renderCard(msg(), { selected: true });
    expect(container.querySelector('.fluxo-bloco')).toHaveAttribute('data-selecionado', 'true');
    unmount();
    const outro = renderCard(msg());
    expect(outro.container.querySelector('.fluxo-bloco')).not.toHaveAttribute('data-selecionado');
  });

  it('incompleto e não selecionado mantém a borda amarela', () => {
    const { container } = renderCard(msg(), { problem: 'Falta escrever a mensagem.' });
    const bloco = container.querySelector('.fluxo-bloco');
    expect(bloco).toHaveClass('border-amber-500');
    expect(bloco).not.toHaveAttribute('data-selecionado');
  });

  it('o Início continua verde', () => {
    render(
      <ReactFlowProvider>
        <FlowStartNode {...({ id: 'inicio', data: { summary: 'Quando o lead chega', hint: null, onEdit: vi.fn() } } as never)} />
      </ReactFlowProvider>,
    );
    const inicio = screen.getByTestId('bloco-inicio');
    expect(inicio).toHaveClass('fluxo-inicio');
    expect(inicio).toHaveClass('border-emerald-500');
  });
});

describe('resumo do bloco Mensagem', () => {
  it('o resumo recorta em 2 linhas sem invadir "Pelo número do responsável"', () => {
    const longo = 'Oi, posso fazer uma simulação de entrada e parcela pra você ver se cabe no bolso? Só me responder com um sim que eu já te mando os números certinhos.';
    renderCard(msg({ config: { message: longo, send_from: 'owner' } }));
    const linhaDoNumero = screen.getByText('Pelo número do responsável pelo lead');
    expect(linhaDoNumero.className).not.toMatch(/-mt-/);
    const recorte = document.querySelector('.line-clamp-2') as HTMLElement;
    expect(recorte).not.toBeNull();
    // O espaço em volta fica num contêiner por fora: padding dentro do recorte mostra a 3ª linha cortada.
    expect(recorte.className).not.toMatch(/\bp[ytb]?-\d/);
  });
});

