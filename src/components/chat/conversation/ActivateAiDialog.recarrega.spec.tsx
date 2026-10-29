import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivateAiDialog from './ActivateAiDialog';
import { EVENTO_IA_RECARREGAR } from '@/features/conversas/atalhosDoLead';
import type { Conversation } from '@/types/chat/api';

const list = vi.hoisted(() => vi.fn());
const engage = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list, engage } }));
vi.mock('@/services/chat/chatService', () => ({ chatService: { getSalesAgentStatus: status } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conversa = { id: 'c1', inbox_id: 'i1' } as unknown as Conversation;
const agente = { id: 'a1', name: 'Sara IA', inbox_id: 'i1', enabled: true, default_property_code: null };
const ouvinte = vi.fn();

beforeEach(() => {
  list.mockReset().mockResolvedValue([agente]);
  engage.mockReset();
  status.mockReset().mockResolvedValue(null);
  ouvinte.mockReset();
  window.addEventListener(EVENTO_IA_RECARREGAR, ouvinte);
});
afterEach(() => window.removeEventListener(EVENTO_IA_RECARREGAR, ouvinte));

const acionar = async () => {
  render(<ActivateAiDialog conversation={conversa} open onOpenChange={() => {}} />);
  await screen.findByText('Sara IA');
  await userEvent.click(screen.getByRole('button', { name: /Acionar IA|Ativar IA$/ }));
};

describe('ActivateAiDialog · avisa o robô do topo', () => {
  it('acionou com sucesso: dispara a recarga desta conversa', async () => {
    engage.mockResolvedValue({});
    await acionar();
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail).toEqual({ conversationId: 'c1' });
  });

  it('falhou: não dispara nada', async () => {
    engage.mockRejectedValue(new Error('x'));
    await acionar();
    expect(engage).toHaveBeenCalled();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
