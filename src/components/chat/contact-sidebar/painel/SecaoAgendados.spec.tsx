import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SecaoAgendados from './SecaoAgendados';
import { avisarAgendadosMudaram } from '@/features/conversas/agendados';

// A seção "Agendados" do painel do lead (04/10/2026): só existe com mensagem
// agendada que ainda não saiu; ✏️ abre o agendamento pra editar e ✕ cancela
// depois da pergunta.

const list = vi.fn();
const cancel = vi.fn();
vi.mock('@/services/scheduledActions/scheduledActionsService', () => ({
  scheduledActionsService: {
    list: (...a: unknown[]) => list(...a),
    cancel: (...a: unknown[]) => cancel(...a),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

// A janela de agendamento é dublê: o que importa aqui é ela abrir em modo
// edição com o agendamento certo.
vi.mock('@/components/scheduledActions/ScheduleActionModal', () => ({
  ScheduleActionModal: ({ action, contactId, onClose }: { action?: { id: string } | null; contactId?: string; onClose: () => void }) => (
    <div>
      <span>{`janela-agendamento:${contactId}:${action?.id ?? 'novo'}`}</span>
      <button type="button" onClick={onClose}>fechar-janela</button>
    </div>
  ),
}));

const agendamento = (id: string, quando: Date, texto: string) => ({
  id,
  action_type: 'send_message',
  status: 'scheduled',
  scheduled_for: quando.toISOString(),
  payload: { channel: 'whatsapp', funnel_items: [{ kind: 'text', text_content: texto }] },
  created_by: 'u',
  retry_count: 0,
  max_retries: 3,
});

const amanha = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

beforeEach(() => {
  list.mockReset();
  cancel.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SecaoAgendados', () => {
  it('sem mensagem agendada, a seção não aparece', async () => {
    list.mockResolvedValue([]);
    render(<SecaoAgendados contactId="c1" />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.queryByText('Agendados')).toBeNull();
  });

  it('busca só as mensagens agendadas deste lead', async () => {
    list.mockResolvedValue([]);
    render(<SecaoAgendados contactId="c1" />);
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ contact_id: 'c1', status: 'scheduled', action_type: 'send_message' }),
      ),
    );
  });

  it('mostra quando sai e o começo da mensagem; o que já saiu não entra', async () => {
    list.mockResolvedValue([
      agendamento('a1', amanha(), 'Oi! Lembrando da visita de amanhã no decorado'),
      { ...agendamento('a2', amanha(), 'Já foi'), status: 'completed' },
    ]);
    render(<SecaoAgendados contactId="c1" />);

    expect(await screen.findByText('Agendados')).toBeTruthy();
    expect(screen.getByText('Amanhã às 09:00')).toBeTruthy();
    expect(screen.getByText('Oi! Lembrando da visita de amanhã no decorado')).toBeTruthy();
    expect(screen.queryByText('Já foi')).toBeNull();
  });

  it('o lápis abre o agendamento em modo edição, e fechar relê a lista', async () => {
    list.mockResolvedValue([agendamento('a1', amanha(), 'Oi')]);
    render(<SecaoAgendados contactId="c1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Editar agendamento' }));
    expect(await screen.findByText('janela-agendamento:c1:a1')).toBeTruthy();

    const antes = list.mock.calls.length;
    fireEvent.click(screen.getByText('fechar-janela'));
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(antes));
    expect(screen.queryByText('janela-agendamento:c1:a1')).toBeNull();
  });

  it('o ✕ pergunta antes e só cancela depois do sim', async () => {
    list.mockResolvedValueOnce([agendamento('a1', amanha(), 'Oi')]).mockResolvedValue([]);
    cancel.mockResolvedValue(undefined);
    render(<SecaoAgendados contactId="c1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }));
    expect(await screen.findByText('Cancelar esta mensagem agendada?')).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar mensagem' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('a1'));
    expect(toastSuccess).toHaveBeenCalledWith('Mensagem agendada cancelada.');
    await waitFor(() => expect(screen.queryByText('Agendados')).toBeNull());
  });

  it('desistir na pergunta não cancela', async () => {
    list.mockResolvedValue([agendamento('a1', amanha(), 'Oi')]);
    render(<SecaoAgendados contactId="c1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manter' }));
    await waitFor(() => expect(screen.queryByText('Cancelar esta mensagem agendada?')).toBeNull());
    expect(cancel).not.toHaveBeenCalled();
  });

  it('relê quando alguém agenda pra este lead (aviso do "⋮" ou do card)', async () => {
    list.mockResolvedValueOnce([]).mockResolvedValue([agendamento('a1', amanha(), 'Nova')]);
    render(<SecaoAgendados contactId="c1" />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => avisarAgendadosMudaram('outro-lead'));
    expect(list).toHaveBeenCalledTimes(1);

    act(() => avisarAgendadosMudaram('c1'));
    expect(await screen.findByText('Nova')).toBeTruthy();
  });

  it('relê quando a conversa mexe (a agendada que saiu some)', async () => {
    list.mockResolvedValueOnce([agendamento('a1', amanha(), 'Oi')]).mockResolvedValue([]);
    const { rerender } = render(<SecaoAgendados contactId="c1" atualizarQuando="t1" />);
    expect(await screen.findByText('Agendados')).toBeTruthy();

    rerender(<SecaoAgendados contactId="c1" atualizarQuando="t2" />);
    await waitFor(() => expect(screen.queryByText('Agendados')).toBeNull());
  });
});
