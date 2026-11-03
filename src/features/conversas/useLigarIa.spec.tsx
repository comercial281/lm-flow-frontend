import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Ligar a IA num lead, igual no menu da conversa, no robô do topo e no cartão do funil (C81).

const s = vi.hoisted(() => ({ listForInbox: vi.fn(), toggle: vi.fn(), getConversation: vi.fn() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { listForInbox: s.listForInbox } }));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { toggleSalesAgent: s.toggle, getConversation: s.getConversation },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useLigarIa } from './useLigarIa';
import ReligarIaDialog from '@/components/chat/conversation/ReligarIaDialog';

const aoLigar = vi.fn();
function Tela({ conversa }: { conversa?: { inbox_id: string; additional_attributes?: Record<string, unknown> } }) {
  const { pedirLigar, janela } = useLigarIa({ aoLigar });
  return (
    <>
      <button onClick={() => void pedirLigar('c1', conversa as never)}>ligar</button>
      <ReligarIaDialog {...janela} />
    </>
  );
}
const agentes = [{ id: 'a', name: 'Agente A' }, { id: 'b', name: 'Agente B' }];

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  aoLigar.mockReset();
  s.getConversation.mockResolvedValue({ data: { inbox_id: 'i1', additional_attributes: {} } });
  s.toggle.mockResolvedValue({ status: 'active', label: 'IA ligada' });
});

describe('useLigarIa', () => {
  it('um agente só no número: liga direto, sem escolha', async () => {
    s.listForInbox.mockResolvedValue([agentes[0]]);
    render(<Tela />);
    await userEvent.click(screen.getByText('ligar'));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('c1', true));
    expect(s.listForInbox).toHaveBeenCalledWith('i1');
    expect(screen.queryByText('Escolha qual agente atende')).toBeNull();
    expect(aoLigar).toHaveBeenCalled();
  });

  it('número dividido: pede a escolha (marcado o que já está na conversa) e liga com o id', async () => {
    s.listForInbox.mockResolvedValue(agentes);
    render(<Tela conversa={{ inbox_id: 'i1', additional_attributes: { sales_agent_id: 'a' } }} />);
    await userEvent.click(screen.getByText('ligar'));
    expect(await screen.findByText('Escolha qual agente atende')).toBeInTheDocument();
    expect(s.toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Agente A' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Religar IA' }));
    await waitFor(() => expect(s.toggle).toHaveBeenCalledWith('c1', true, 'b'));
    expect(aoLigar).toHaveBeenCalled();
  });

  it('a recusa do servidor aparece como veio, e a janela fica aberta', async () => {
    s.listForInbox.mockResolvedValue(agentes);
    s.toggle.mockRejectedValue({ response: { data: { error: { message: 'Essa IA não atende o número desta conversa. Escolha uma IA deste número.' } } } });
    render(<Tela conversa={{ inbox_id: 'i1' }} />);
    await userEvent.click(screen.getByText('ligar'));
    await userEvent.click(await screen.findByRole('radio', { name: 'Agente B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Religar IA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa IA não atende o número desta conversa. Escolha uma IA deste número.');
    expect(aoLigar).not.toHaveBeenCalled();
  });
});
