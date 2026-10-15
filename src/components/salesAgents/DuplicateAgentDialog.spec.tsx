import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import DuplicateAgentDialog from './DuplicateAgentDialog';

describe('DuplicateAgentDialog (miolo da janela)', () => {
  it('tem o grupo A cópia e o aviso do mesmo número só quando escolhe o número da original', async () => {
    const agent = agenteDeTeste({ inbox_id: 7 } as never);
    render(<DuplicateAgentDialog agent={agent} inboxes={[{ id: 7, name: 'Principal' }]} onClose={vi.fn()} onDuplicated={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('group', { name: 'A cópia' })).toBeInTheDocument();
    expect(within(dialogo).queryByText(/mesmo número da IA original/)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Número em que a cópia vai atender'), '7');
    expect(within(dialogo).getByText(/mesmo número da IA original/)).toBeInTheDocument();
  });
});
