import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { FlowNodeCard, type FlowNodeCardData } from './FlowNodeCard';

// O nome padrão de send_whatsapp hoje é "Mandar WhatsApp" (vira "Mensagem" só mais adiante).
const PADRAO = 'Mandar WhatsApp';

const msg = (over: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: { message: 'Oi' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: 0, pos_y: 0, steps: [], ...over,
});

function renderCard(p: { node: FlowAutomationNode; onRename?: () => void; onEdit?: () => void; allow?: FlowNodeCardData['allow'] }) {
  const data: FlowNodeCardData = {
    node: p.node, lookups: {} as FlowNodeCardData['lookups'], allow: p.allow,
    onEdit: p.onEdit ?? vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(),
    onRename: p.onRename ?? vi.fn(),
  };
  return render(
    <ReactFlowProvider>
      <FlowNodeCard {...({ id: 'n1', data, selected: false } as never)} />
    </ReactFlowProvider>,
  );
}

describe('renomear o bloco no cartão', () => {
  it('clicar no nome deixa renomear; Enter grava e não abre a janela', () => {
    const onRename = vi.fn(); const onEdit = vi.fn();
    renderCard({ node: msg({ label: null }), onRename, onEdit });
    fireEvent.click(screen.getByRole('button', { name: `Renomear ${PADRAO}` }));
    const campo = screen.getByLabelText('Nome do bloco');
    fireEvent.change(campo, { target: { value: 'Abertura' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('n1', 'Abertura');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('Esc cancela; nome vazio volta ao padrão', () => {
    const onRename = vi.fn();
    renderCard({ node: msg({ label: 'Abertura' }), onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Abertura' }));
    fireEvent.keyDown(screen.getByLabelText('Nome do bloco'), { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Abertura' }));
    fireEvent.change(screen.getByLabelText('Nome do bloco'), { target: { value: '  ' } });
    fireEvent.blur(screen.getByLabelText('Nome do bloco'));
    expect(onRename).toHaveBeenCalledWith('n1', null);
  });

  it('sem permissão (guiado ou só ver) o nome é texto', () => {
    renderCard({ node: msg({ label: 'Abertura' }), allow: { edit: true, duplicate: false, remove: true, add: false, rename: false } });
    expect(screen.queryByRole('button', { name: 'Renomear Abertura' })).toBeNull();
    expect(screen.getByText('Abertura')).toBeTruthy();
  });
});
