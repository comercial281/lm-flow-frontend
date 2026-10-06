import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

vi.mock('../blocos/FollowupSection', () => ({
  FollowupPipelinesRow: () => <p>quais leads</p>,
  FollowupHoursRow: () => <p>quando pode sair</p>,
  FollowupActionPicker: () => <p>o que ela faz</p>,
}));

import Passo7VoltarAChamar from './Passo7VoltarAChamar';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Passo7VoltarAChamar agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

describe('Passo 7 · Voltar a chamar', () => {
  it('ligar a retomada manda só ela', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Retomar a pergunta antes do follow-up'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { reengagement_enabled: true });
  });

  // 06/10/2026: a IA só entrega o lead. Um campo de dias (o silêncio até entregar),
  // sem "Máximo de tentativas" e sem o aviso de "sem limite".
  it('um campo de dias, sem teto de tentativas', () => {
    abrir(agenteDeTeste({ followup_max_attempts: 0 }));
    expect(screen.getByLabelText('Entregar o lead depois de (dias sem resposta)')).toBeTruthy();
    expect(screen.getByText('Quanto tempo de silêncio até entregar o lead.')).toBeTruthy();
    expect(screen.queryByLabelText('Máximo de tentativas')).toBeNull();
    expect(screen.queryByText(/Sem limite de tentativas/)).toBeNull();
    expect(screen.queryByText(/Escrever a mensagem/)).toBeNull();
  });

  it('mudar os dias grava o mínimo e o máximo iguais', async () => {
    abrir(agenteDeTeste({ followup_min_days: 2, followup_max_days: 3 }));
    const campo = screen.getByLabelText('Entregar o lead depois de (dias sem resposta)');
    fireEvent.change(campo, { target: { value: '4' } });
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { followup_min_days: 4, followup_max_days: 4 });
  });

  it('a linha do tempo mostra o que acontece', () => {
    abrir(agenteDeTeste({ reengagement_enabled: true, reengagement_first_hours: 1, reengagement_second_hours: 8 }));
    expect(screen.getByText('1h sem resposta: 1ª retomada')).toBeTruthy();
    expect(screen.getByText('Entrega o lead ao follow-up depois de 2 dias sem resposta')).toBeTruthy();
  });

  // 06/10/2026: o servidor recusa ligar o follow-up com a IA ainda em "A IA escreve".
  it('ligar o follow-up numa IA ainda em "A IA escreve": o Salvar não manda e diz por quê', async () => {
    abrir(agenteDeTeste({ followup_enabled: false, followup_action: 'ai' }));
    await userEvent.click(screen.getByLabelText('Ir atrás de quem sumiu'));
    await salvar();
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Escolha como o follow-up continua: a IA não escreve mais o follow-up.');
  });

  it('IA sem escolha nenhuma também não salva com o follow-up ligado', async () => {
    abrir(agenteDeTeste({ followup_enabled: true, followup_action: undefined as never, reengagement_enabled: false }));
    await userEvent.click(screen.getByLabelText('Retomar a pergunta antes do follow-up'));
    await salvar();
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Escolha o que ela faz quando o lead some.');
  });

  it('desligar o follow-up de uma IA em "A IA escreve" salva normalmente', async () => {
    abrir(agenteDeTeste({ followup_enabled: true, followup_action: 'ai' }));
    await userEvent.click(screen.getByLabelText('Ir atrás de quem sumiu'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { followup_enabled: false });
  });

  it('a recusa do servidor aparece no passo', async () => {
    update.mockRejectedValueOnce({ response: { status: 422, data: { error: { message: 'Escolha como o follow-up continua.' } } } });
    abrir(agenteDeTeste({ followup_enabled: false }));
    await userEvent.click(screen.getByLabelText('Ir atrás de quem sumiu'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { followup_enabled: true });
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha como o follow-up continua.');
  });

  it('desligado: some o resto', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Ir atrás de quem sumiu'));
    expect(screen.queryByText('o que ela faz')).toBeNull();
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { followup_enabled: false });
  });
});
