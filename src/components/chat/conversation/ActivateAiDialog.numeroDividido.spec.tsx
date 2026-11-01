import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivateAiDialog from './ActivateAiDialog';
import type { Conversation } from '@/types/chat/api';

const list = vi.hoisted(() => vi.fn());
const engage = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list, engage } }));
vi.mock('@/services/chat/chatService', () => ({ chatService: { getSalesAgentStatus: status } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conversa = { id: 'c1', inbox_id: 'i1' } as unknown as Conversation;
const agente = (id: string, name: string, position: number, inbox_id = 'i1') => ({
  id, name, enabled: true, inbox_id, followup_only: false, absorbed_into_id: null, default_property_code: null,
  numbers: [{ inbox_id, position, enabled: true }],
});

beforeEach(() => {
  list.mockReset();
  engage.mockReset().mockResolvedValue({});
  status.mockReset().mockResolvedValue(null);
});

describe('ActivateAiDialog · número dividido', () => {
  it('pede a escolha, com o Ativar IA travado até escolher, e aciona o agente escolhido', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0), agente('b', 'Agente B', 1)]);
    render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
    expect(await screen.findByText('Escolha qual agente atende')).toBeInTheDocument();
    const ativar = screen.getByRole('button', { name: /Ativar IA/ });
    expect(ativar).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    expect(ativar).toBeEnabled();
    await userEvent.click(ativar);
    await waitFor(() => expect(engage).toHaveBeenCalledWith('b', expect.objectContaining({ conversationId: 'c1' })));
  });

  it('lista pelos números do agente, não pelo espelho inbox_id', async () => {
    const a = { ...agente('a', 'Agente A', 0, 'i9'), numbers: [{ inbox_id: 'i9', position: 0, enabled: true }, { inbox_id: 'i1', position: 0, enabled: true }] };
    list.mockResolvedValue([a, agente('b', 'Agente B', 1)]);
    render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
    expect(await screen.findByRole('radio', { name: 'Agente A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Agente B' })).toBeInTheDocument();
  });

  it('com um agente só, vem marcado e a escolha some', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0), agente('c', 'Agente C', 0, 'i2')]);
    render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
    expect(await screen.findByText('Agente A')).toBeInTheDocument();
    expect(screen.queryByText('Escolha qual agente atende')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ativar IA/ }));
    await waitFor(() => expect(engage).toHaveBeenCalledWith('a', expect.anything()));
  });
});
