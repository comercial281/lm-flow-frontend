import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivateAiDialog from './ActivateAiDialog';
import type { Conversation } from '@/types/chat/api';

const list = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list, engage: vi.fn() } }));
vi.mock('@/services/chat/chatService', () => ({ chatService: { getSalesAgentStatus: status } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conversa = { id: 'c1', inbox_id: 'i1' } as unknown as Conversation;

beforeEach(() => {
  list.mockReset().mockResolvedValue([]);
  status.mockReset();
});

describe('ActivateAiDialog · sem IA no canal', () => {
  it('sem IA no canal: uma mensagem só', async () => {
    status.mockResolvedValue({ why: 'Este canal não tem IA ativa.', next_step: 'Ative uma IA no canal.' });
    render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
    expect(await screen.findByText('Este canal não tem IA ativa.')).toBeInTheDocument();
    expect(screen.getByText('Ative uma IA no canal.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma IA Vendedora/)).toBeNull();
  });

  it('sem situação do lead mostra só a orientação padrão', async () => {
    status.mockResolvedValue(null);
    render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/Nenhuma IA Vendedora/)).toBeInTheDocument();
  });
});
