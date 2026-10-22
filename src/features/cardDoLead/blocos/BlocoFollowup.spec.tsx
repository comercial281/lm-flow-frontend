import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlocoFollowup from './BlocoFollowup';
import type { CardDoLead } from '../useCardDoLead';

// O bloco Follow-up do card leva o id do card pra janela "Colocar em follow-up"
// e, depois do Iniciar, avisa o card (a Etapa vai pra coluna Follow-up).

vi.mock('@/components/pipelines/FollowupTimeline', () => ({
  default: ({ pipelineItemId, aoColocar }: { pipelineItemId?: string | null; aoColocar?: () => void }) => (
    <button type="button" onClick={() => aoColocar?.()}>iniciou no card {pipelineItemId}</button>
  ),
}));

describe('BlocoFollowup', () => {
  it('passa o id do card e liga o Iniciar na Etapa do card', () => {
    const aoColocarEmFollowup = vi.fn();
    const card = {
      contato: { id: 'c1', name: 'Maria' },
      item: { id: 'i1', conversation: null },
      etapa: { aoColocarEmFollowup },
    } as unknown as CardDoLead;

    render(<BlocoFollowup card={card} />);
    fireEvent.click(screen.getByRole('button', { name: 'iniciou no card i1' }));

    expect(aoColocarEmFollowup).toHaveBeenCalledTimes(1);
  });
});
