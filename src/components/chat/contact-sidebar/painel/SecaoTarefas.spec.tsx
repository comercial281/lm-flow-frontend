import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/features/tarefas/TarefasDoLead', () => ({
  default: ({ pipelineItemIds, criarNoCard, abrirNovaAgora }: { pipelineItemIds: string[]; criarNoCard: string | null; abrirNovaAgora?: boolean }) => (
    <div>{`bloco:${pipelineItemIds.join(',')}:${criarNoCard}:${abrirNovaAgora ? 'abrir' : 'quieto'}`}</div>
  ),
}));
vi.mock('../PipelineManagement', () => ({
  default: ({ onPipelineUpdated }: { onPipelineUpdated: () => void }) => <button type="button" onClick={onPipelineUpdated}>colocou</button>,
}));

import SecaoTarefas from './SecaoTarefas';

const funil = (itens: string[]) => [{ id: 'p1', name: 'Vendas', stages: [{ id: 's1', name: 'Novo', position: 1, items: itens.map(id => ({ id, pipeline_id: 'p1' })) }] }];

describe('SecaoTarefas', () => {
  it('com card, mostra o bloco das tarefas dele', () => {
    render(<SecaoTarefas conversationId="9" pipelines={funil(['c1']) as never} carregando={false} onAtualizado={() => {}} />);
    expect(screen.getByText('bloco:c1:c1:quieto')).toBeInTheDocument();
  });

  it('sem card, oferece colocar no funil e depois abre a tarefa nova', () => {
    const onAtualizado = vi.fn();
    const { rerender } = render(<SecaoTarefas conversationId="9" pipelines={[]} carregando={false} onAtualizado={onAtualizado} />);
    expect(screen.getByText('Pra criar tarefa, coloque o lead no funil.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no funil' }));
    fireEvent.click(screen.getByRole('button', { name: 'colocou' }));
    expect(onAtualizado).toHaveBeenCalled();
    rerender(<SecaoTarefas conversationId="9" pipelines={funil(['c2']) as never} carregando={false} onAtualizado={onAtualizado} />);
    expect(screen.getByText('bloco:c2:c2:abrir')).toBeInTheDocument();
  });
});
