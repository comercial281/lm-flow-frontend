import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AtalhosDoLead from './AtalhosDoLead';
import { useIaDaConversa } from '@/features/conversas/useIaDaConversa';
import { EVENTO_AGENDADOS_MUDARAM } from '@/features/conversas/agendados';

// Atalhos do painel do lead (07/10): Agendar mensagem · IA · Agendar visita,
// botões redondos logo abaixo do nome. Cada um só existe quando a ação existe.

const getSalesAgentStatus = vi.fn();
const toggleSalesAgent = vi.fn();
vi.mock('@/services/chat/chatService', () => {
  const servico = {
    getSalesAgentStatus: (...a: unknown[]) => getSalesAgentStatus(...a),
    toggleSalesAgent: (...a: unknown[]) => toggleSalesAgent(...a),
  };
  return { chatService: servico, default: servico };
});

const addLabels = vi.fn();
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { addLabels: (...a: unknown[]) => addLabels(...a) },
}));

let agendarLigado = true;
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useFeature: () => agendarLigado,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/scheduledActions/ScheduleActionModal', () => ({
  ScheduleActionModal: ({ contactId, onClose }: { contactId?: string; onClose: () => void }) => (
    <div role="dialog" aria-label="janela de agendar">
      contato {contactId}
      <button onClick={onClose}>fechar agendar</button>
    </div>
  ),
}));

vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: ({
    leadInicial,
    onCreated,
  }: {
    leadInicial?: { name: string; owner?: { name: string } | null };
    onCreated?: () => void;
  }) => (
    <div role="dialog" aria-label="janela de visita">
      {leadInicial?.name} · {leadInicial?.owner?.name ?? 'sem dono'}
      <button onClick={() => onCreated?.()}>criar visita</button>
    </div>
  ),
}));

const contact = { id: 'contato-1', name: 'Lead Fictício', phone_number: '+5511912345634' } as never;
const conversation = { id: 'conv-1' } as never;
const funil = [
  {
    id: 'funil-1',
    stages: [{ id: 'e1', items: [{ id: 'item-1', pipeline_id: 'funil-1', assignee: { id: '3', name: 'Marina' } }] }],
  },
] as never;

const estado = (status: string, label = 'IA atendendo') => ({ status, label, agent_id: 'ia-1' });

const renderAtalhos = (emOferta = false) =>
  render(
    <AtalhosDoLead
      contact={contact}
      conversation={conversation}
      pipelines={funil}
      nome="Lead Fictício"
      emOferta={emOferta}
    />,
  );

// O robô do topo da conversa, reduzido ao que importa: o estado que ele mostra.
function RoboDoTopo() {
  const { estado: s } = useIaDaConversa('conv-1');
  return <p data-testid="robo-do-topo">{s?.status ?? 'nada'}</p>;
}

describe('AtalhosDoLead', () => {
  beforeEach(() => {
    agendarLigado = true;
    getSalesAgentStatus.mockReset();
    toggleSalesAgent.mockReset();
    addLabels.mockReset();
    addLabels.mockResolvedValue({});
    getSalesAgentStatus.mockRejectedValue(new Error('sem IA'));
  });

  it('número sem IA: Agendar mensagem e Agendar visita, sem o robô', async () => {
    renderAtalhos();
    await waitFor(() => expect(getSalesAgentStatus).toHaveBeenCalledWith('conv-1'));
    expect(screen.getByRole('button', { name: 'Agendar mensagem' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agendar visita' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /clique para/ })).toBeNull();
  });

  it('número com IA "none" também não mostra o robô', async () => {
    getSalesAgentStatus.mockResolvedValue({ state: { status: 'none', label: 'Sem IA', agent_id: null } });
    renderAtalhos();
    await waitFor(() => expect(getSalesAgentStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /clique para/ })).toBeNull();
  });

  it('IA ligada: o robô desliga, e o robô do topo da conversa acompanha na hora', async () => {
    getSalesAgentStatus.mockResolvedValue({ state: estado('active') });
    toggleSalesAgent.mockResolvedValue(estado('paused', 'IA desligada neste lead'));
    render(
      <>
        <RoboDoTopo />
        <AtalhosDoLead contact={contact} conversation={conversation} pipelines={[]} nome="x" emOferta={false} />
      </>,
    );

    const robo = await screen.findByRole('button', { name: 'IA atendendo — clique para desativar' });
    await waitFor(() => expect(screen.getByTestId('robo-do-topo').textContent).toBe('active'));
    fireEvent.click(robo);

    await waitFor(() => expect(toggleSalesAgent).toHaveBeenCalledWith('conv-1', false));
    expect(await screen.findByRole('button', { name: 'IA desligada neste lead — clique para reativar' })).toBeTruthy();
    expect(screen.getByTestId('robo-do-topo').textContent).toBe('paused');
  });

  it('Agendar mensagem abre a janela de agendar com o contato e, ao fechar, avisa os Agendados', async () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_AGENDADOS_MUDARAM, ouvinte);
    renderAtalhos();

    fireEvent.click(screen.getByRole('button', { name: 'Agendar mensagem' }));
    const janela = await screen.findByRole('dialog', { name: 'janela de agendar' });
    expect(janela.textContent).toContain('contato contato-1');

    fireEvent.click(screen.getByText('fechar agendar'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'janela de agendar' })).toBeNull());
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail).toEqual({ contactId: 'contato-1' });
    window.removeEventListener(EVENTO_AGENDADOS_MUDARAM, ouvinte);
  });

  it('Agendar mensagem some quando a função está desligada pro cliente', async () => {
    agendarLigado = false;
    renderAtalhos();
    await waitFor(() => expect(getSalesAgentStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Agendar mensagem' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Agendar visita' })).toBeTruthy();
  });

  it('Agendar visita abre com o lead e o responsável do card, e põe a etiqueta visita-agendada', async () => {
    renderAtalhos();
    fireEvent.click(screen.getByRole('button', { name: 'Agendar visita' }));

    const janela = await screen.findByRole('dialog', { name: 'janela de visita' });
    expect(janela.textContent).toContain('Lead Fictício · Marina');

    fireEvent.click(screen.getByText('criar visita'));
    await waitFor(() => expect(addLabels).toHaveBeenCalledWith('conv-1', ['visita-agendada']));
    expect(screen.queryByRole('dialog', { name: 'janela de visita' })).toBeNull();
  });

  it('oferta da roleta: as duas janelas mostram o telefone, então só o robô fica', async () => {
    getSalesAgentStatus.mockResolvedValue({ state: estado('active') });
    renderAtalhos(true);
    expect(await screen.findByRole('button', { name: /clique para desativar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Agendar mensagem' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).toBeNull();
  });

  it('oferta e número sem IA: a fileira não existe', async () => {
    renderAtalhos(true);
    await waitFor(() => expect(getSalesAgentStatus).toHaveBeenCalled());
    expect(screen.queryByRole('group', { name: 'Atalhos do lead' })).toBeNull();
  });
});
