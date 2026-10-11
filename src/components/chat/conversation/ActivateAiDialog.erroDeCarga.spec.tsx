import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivateAiDialog from './ActivateAiDialog';
import type { Conversation } from '@/types/chat/api';

const list = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list, engage: vi.fn() } }));
vi.mock('@/services/chat/chatService', () => ({ chatService: { getSalesAgentStatus: status } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conversa = { id: 'c1', inbox_id: 'i1' } as unknown as Conversation;
const agente = { id: 'a1', name: 'Sara IA', inbox_id: 'i1', enabled: true, default_property_code: null };
const abrir = () => render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);

beforeEach(() => {
  list.mockReset();
  status.mockReset().mockResolvedValue(null);
});

describe('ActivateAiDialog · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não "Nenhuma IA"', async () => {
    list.mockRejectedValueOnce(new Error('rede'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma IA/)).toBeNull();
    list.mockResolvedValueOnce([agente]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Sara IA')).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas mostra uma IA só', async () => {
    list.mockRejectedValueOnce(new Error('rede'));
    abrir();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    list.mockResolvedValue([agente]);
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText('Sara IA')).toHaveLength(1);
  });
});
