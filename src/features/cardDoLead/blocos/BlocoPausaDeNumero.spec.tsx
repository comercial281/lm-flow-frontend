import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BlocoPausaDeNumero from './BlocoPausaDeNumero';

const forCard = vi.fn();
const resume = vi.fn();
vi.mock('@/services/flowAutomations/flowAutomationInstancesService', () => ({
  flowAutomationInstancesService: { forCard: (...a: unknown[]) => forCard(...a), resume: (...a: unknown[]) => resume(...a) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

const pausado = (sendable = true) => ({
  id: 'inst1', flow_automation_id: 'f1', flow_name: 'Boas-vindas', state: 'paused', active: true, phase: 'paused',
  paused_code: 'other_number', until: null, started_at: null,
  number_conflict: { conversation_final: '45', flow_final: '92', conversation_sendable: sendable },
});

describe('BlocoPausaDeNumero', () => {
  beforeEach(() => { vi.clearAllMocks(); resume.mockResolvedValue({ message: 'Retomado.' }); });

  it('não desenha nada sem pausa por número', async () => {
    forCard.mockResolvedValue({ flows: [{ ...pausado(), paused_code: 'disconnected' }], startable: [] });
    const { container } = render(<BlocoPausaDeNumero contactId="c1" conversationId={null} />);
    await waitFor(() => expect(forCard).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('retoma pela conversa chamando resume(id, { choice, always })', async () => {
    forCard.mockResolvedValueOnce({ flows: [pausado()], startable: [] }).mockResolvedValue({ flows: [], startable: [] });
    const aoResolver = vi.fn();
    render(<BlocoPausaDeNumero contactId="c1" conversationId={null} aoResolver={aoResolver} />);
    expect(await screen.findByText('Boas-vindas pausado: já conversa em outro número (final 45)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele (final 45)' }));
    await waitFor(() => expect(resume).toHaveBeenCalledWith('inst1', { choice: 'conversation', always: false }));
    await waitFor(() => expect(aoResolver).toHaveBeenCalled());
  });

  it('número que não manda sozinho: esconde "pela conversa" e diz o motivo', async () => {
    forCard.mockResolvedValue({ flows: [pausado(false)], startable: [] });
    render(<BlocoPausaDeNumero contactId="c1" conversationId={null} />);
    expect(await screen.findByText('Esse número não manda mensagem sozinho.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mandar pela conversa dele/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pelo número do fluxo (final 92)' }));
    await waitFor(() => expect(resume).toHaveBeenCalledWith('inst1', { choice: 'flow', always: true }));
  });

  it('mostra a mensagem do servidor no 422', async () => {
    forCard.mockResolvedValue({ flows: [pausado()], startable: [] });
    resume.mockRejectedValue({ response: { data: { errors: ['Escolha um número.'] } } });
    render(<BlocoPausaDeNumero contactId="c1" conversationId={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mandar pelo número do fluxo (final 92)' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Escolha um número.'));
  });
});
