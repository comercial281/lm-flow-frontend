import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Position } from '@xyflow/react';
import type { ComponentProps, ReactNode } from 'react';

// Construtor (23/10/2026): a linha entre dois blocos se corta clicando nela e
// no botão que aparece no meio (ou Delete). Antes só apagando o bloco.

// O rótulo da linha vai num portal que só existe dentro do canvas montado.
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <foreignObject>{children}</foreignObject>,
}));

import { FlowEdge } from './FlowEdge';

const renderEdge = (patch: Partial<ComponentProps<typeof FlowEdge>> = {}) => {
  const onCut = vi.fn();
  render(
    <svg>
      <FlowEdge
        id="s:out" source="s" target="b"
        sourceX={0} sourceY={0} targetX={200} targetY={0}
        sourcePosition={Position.Right} targetPosition={Position.Left}
        selected deletable data={{ onCut }}
        {...patch}
      />
    </svg>,
  );
  return onCut;
};

describe('Linha do construtor', () => {
  it('selecionada, mostra "Cortar conexão" e corta aquela linha', () => {
    const onCut = renderEdge();
    fireEvent.click(screen.getByRole('button', { name: 'Cortar conexão' }));
    expect(onCut).toHaveBeenCalledWith('s:out');
  });

  it('sem clicar na linha, o botão não aparece', () => {
    renderEdge({ selected: false });
    expect(screen.queryByRole('button', { name: 'Cortar conexão' })).toBeNull();
  });

  it('a linha do Início (e o fluxo só de leitura) não oferece o corte', () => {
    renderEdge({ deletable: false });
    expect(screen.queryByRole('button', { name: 'Cortar conexão' })).toBeNull();
  });

  // Dono (29/10/2026), depois do Organizar: "prefiro voltar pra curva mas
  // organizar dessa forma que tá agora". Curva, sem trecho reto nem quina.
  it('a linha é curva, também quando desce pra outra linha do desenho', () => {
    renderEdge({ selected: false, targetX: 360, targetY: 200 });
    const d = document.querySelector('path.react-flow__edge-path')?.getAttribute('d') ?? '';
    expect(d).toMatch(/C/);
    expect(d).not.toMatch(/[LQ]/);
  });
});
