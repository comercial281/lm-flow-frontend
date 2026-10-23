import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JanelaColocarEmFollowup from './JanelaColocarEmFollowup';

// Fase 2 (20/10/2026): uma janela só pra pôr o lead no follow-up, aberta por
// todas as portas (arrastar pra coluna, etapa no card e na conversa, Iniciar do
// bloco, atalho do painel). O servidor diz as opções, o padrão e onde o lead parou.

const placePreview = vi.fn();
const place = vi.fn();
vi.mock('@/services/flowAutomations/flowAutomationInstancesService', () => ({
  flowAutomationInstancesService: {
    placePreview: (...a: unknown[]) => placePreview(...a),
    place: (...a: unknown[]) => place(...a),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

const preview = (over: Record<string, unknown> = {}) => ({
  default_flow_id: 'f2',
  options: [{ id: 'f1', name: 'Follow-up curto' }, { id: 'f2', name: 'Follow-up longo' }],
  current: null,
  progress: null,
  has_followup_column: true,
  ...over,
});

const progresso = (over: Record<string, unknown> = {}) => ({
  flow_automation_id: 'f2', step: 2, total: 5, has_next: true, next_text: 'Oi, ainda procurando apê?', ...over,
});

const aoCancelar = vi.fn();
const aoConcluir = vi.fn();
const abrir = (lead: Record<string, string> = { pipelineItemId: 'card-1' }) =>
  render(<JanelaColocarEmFollowup lead={lead} aoCancelar={aoCancelar} aoConcluir={aoConcluir} />);

beforeEach(() => {
  [placePreview, place, toastSuccess, toastError, aoCancelar, aoConcluir].forEach(m => m.mockReset());
});

describe('JanelaColocarEmFollowup', () => {
  it('janela mostra o padrão marcado e a frase da coluna', async () => {
    placePreview.mockResolvedValue(preview());
    abrir();

    expect(await screen.findByRole('heading', { name: 'Colocar em follow-up' })).toBeInTheDocument();
    const seletor = await screen.findByLabelText('Follow-up');
    expect(seletor).toHaveValue('f2');
    expect(screen.getByRole('option', { name: 'Follow-up curto' })).toBeInTheDocument();
    expect(screen.getByText('O card vai para a coluna Follow-up.')).toBeInTheDocument();
    expect(placePreview).toHaveBeenCalledWith({ pipelineItemId: 'card-1' });
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('funil sem coluna Follow-up avisa que o card fica onde está', async () => {
    placePreview.mockResolvedValue(preview({ has_followup_column: false }));
    abrir();

    expect(
      await screen.findByText('Este funil não tem coluna Follow-up: o follow-up começa e o card fica onde está.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('O card vai para a coluna Follow-up.')).not.toBeInTheDocument();
  });

  it('com progresso oferece continuar da N+1 com a prévia', async () => {
    placePreview.mockResolvedValue(preview({ progress: progresso() }));
    place.mockResolvedValue({ message: 'Follow-up "Follow-up longo" iniciado.', started: true });
    abrir();

    const continuar = await screen.findByRole('button', { name: 'Continuar da mensagem 3' });
    expect(continuar).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Oi, ainda procurando apê?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Começar do início' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() =>
      expect(place).toHaveBeenCalledWith({ pipelineItemId: 'card-1' }, { flowAutomationId: 'f2', mode: 'continue' }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Follow-up "Follow-up longo" iniciado.');
    expect(aoConcluir).toHaveBeenCalledWith({ message: 'Follow-up "Follow-up longo" iniciado.', started: true });
  });

  it('próxima mensagem só de mídia avisa em vez de mostrar texto', async () => {
    placePreview.mockResolvedValue(preview({ progress: progresso({ next_text: null }) }));
    abrir();

    expect(await screen.findByRole('button', { name: 'Continuar da mensagem 3' })).toBeInTheDocument();
    expect(screen.getByText('A próxima mensagem é uma mídia (foto, áudio ou vídeo).')).toBeInTheDocument();
  });

  it('sem próxima mensagem só oferece começar do início', async () => {
    placePreview.mockResolvedValue(preview({ progress: progresso({ step: 5, has_next: false, next_text: null }) }));
    place.mockResolvedValue({ started: true });
    abrir();

    expect(await screen.findByRole('button', { name: 'Começar do início' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continuar da mensagem/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() =>
      expect(place).toHaveBeenCalledWith({ pipelineItemId: 'card-1' }, { flowAutomationId: 'f2', mode: 'restart' }),
    );
  });

  it('o progresso de outro follow-up não oferece continuar no escolhido', async () => {
    placePreview.mockResolvedValue(preview({ progress: progresso({ flow_automation_id: 'f1' }) }));
    abrir();

    const seletor = await screen.findByLabelText('Follow-up');
    expect(screen.queryByRole('button', { name: /Continuar da mensagem/ })).not.toBeInTheDocument();

    fireEvent.change(seletor, { target: { value: 'f1' } });
    expect(await screen.findByRole('button', { name: 'Continuar da mensagem 3' })).toBeInTheDocument();
  });

  it('lead já em follow-up mostra o aviso de troca', async () => {
    placePreview.mockResolvedValue(preview({ current: { flow_automation_id: 'f1', flow_name: 'Follow-up curto', phase: 'waiting' } }));
    abrir();

    // O padrão marcado (f2) não é o atual (f1): troca.
    expect(
      await screen.findByText('Este lead já está no follow-up "Follow-up curto". Iniciar troca pelo escolhido.'),
    ).toBeInTheDocument();
  });

  it('follow-up atual mascarado aparece como veio, sem aspas nem "follow-up" repetido', async () => {
    placePreview.mockResolvedValue(preview({
      current: { flow_automation_id: 'f1', flow_name: 'Follow-up de Ana', flow_masked: true, phase: 'waiting' },
    }));
    abrir();

    expect(
      await screen.findByText('Este lead já está no Follow-up de Ana. Iniciar troca pelo escolhido.'),
    ).toBeInTheDocument();
  });

  it('mesmo follow-up pelo id', async () => {
    // Dois follow-ups com o MESMO nome (um seu, um da equipe): só o id diz qual é o atual.
    placePreview.mockResolvedValue(preview({
      default_flow_id: 'f2',
      options: [
        { id: 'f1', name: 'Follow-up longo', team: true },
        { id: 'f2', name: 'Follow-up longo', team: false },
      ],
      current: { flow_automation_id: 'f2', flow_name: 'Follow-up longo', phase: 'waiting' },
    }));
    abrir();

    expect(await screen.findByText('Este lead já está neste follow-up.')).toBeInTheDocument();
    expect(screen.queryByText(/Iniciar troca pelo escolhido/)).not.toBeInTheDocument();

    // Trocar pro de mesmo nome, mas outro id, volta o aviso de troca.
    fireEvent.change(screen.getByLabelText('Follow-up'), { target: { value: 'f1' } });
    expect(
      await screen.findByText('Este lead já está no follow-up "Follow-up longo". Iniciar troca pelo escolhido.'),
    ).toBeInTheDocument();
  });

  it('follow-up atual sem nome: "um follow-up", sem aspas vazias', async () => {
    placePreview.mockResolvedValue(preview({ current: { flow_automation_id: 'f1', flow_name: null, phase: 'waiting' } }));
    abrir();

    expect(
      await screen.findByText('Este lead já está em um follow-up. Iniciar troca pelo escolhido.'),
    ).toBeInTheDocument();
  });

  it('opções levam o selo Do responsável ou Da equipe', async () => {
    placePreview.mockResolvedValue(preview({
      default_flow_id: 'f1',
      options: [
        { id: 'f1', name: 'Meu follow-up', team: false },
        { id: 'f2', name: 'Follow-up longo', team: true },
      ],
    }));
    abrir();

    expect(await screen.findByLabelText('Follow-up')).toHaveValue('f1');
    expect(screen.getByRole('option', { name: 'Meu follow-up · Do responsável' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Follow-up longo · Da equipe' })).toBeInTheDocument();
  });

  it('recusa do servidor mostra a frase e a janela fica aberta', async () => {
    placePreview.mockResolvedValue(preview());
    place.mockRejectedValue({ response: { status: 403, data: { errors: ['Esse lead não é seu.'] } } });
    abrir();

    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Esse lead não é seu.'));
    expect(aoConcluir).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Colocar em follow-up' })).toBeInTheDocument();
  });

  it('Cancelar fecha sem pedir nada', async () => {
    placePreview.mockResolvedValue(preview());
    abrir();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(aoCancelar).toHaveBeenCalled();
    expect(place).not.toHaveBeenCalled();
  });

  it('sem follow-up ligado não deixa iniciar', async () => {
    placePreview.mockResolvedValue(preview({ options: [], default_flow_id: null }));
    abrir();

    expect(await screen.findByText(/Nenhum follow-up pra iniciar/)).toBeInTheDocument();
    // Fase 3: o follow-up mora em Funis de mensagem → Follow-up.
    expect(screen.getByText('Funis de mensagem → Follow-up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled();
  });
});
