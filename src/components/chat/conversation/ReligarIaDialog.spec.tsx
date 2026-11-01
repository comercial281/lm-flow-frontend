import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReligarIaDialog from './ReligarIaDialog';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

const agentes = [{ id: 'a', name: 'Agente A' }, { id: 'b', name: 'Agente B' }] as unknown as SalesAgent[];

describe('ReligarIaDialog · número dividido', () => {
  it('pede a escolha, trava o Religar até escolher e devolve o id', async () => {
    const onConfirmar = vi.fn();
    render(<ReligarIaDialog agentes={agentes} open onOpenChange={() => {}} onConfirmar={onConfirmar} />);
    expect(screen.getByText('Escolha qual agente atende')).toBeInTheDocument();
    const religar = screen.getByRole('button', { name: 'Religar IA' });
    expect(religar).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    await userEvent.click(religar);
    expect(onConfirmar).toHaveBeenCalledWith('b');
  });
});
