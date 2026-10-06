import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/features/visits/useAgendaLigada', () => ({ useAgendaLigada: () => ({ ligada: false }) }));
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, playbook: vi.fn().mockResolvedValue({ slot_defaults: { lead_pronto: 'já disse a faixa de valor' } }) } };
});
import Agendamento from './Agendamento';

const abrir = (extra = {}, irPara = vi.fn()) => {
  const gravar = gravarDeTeste('agendamento');
  render(<><Agendamento agent={agenteDeTeste(extra)} inboxes={[]} gravar={gravar} irPara={irPara} diagnostico={null} aoChaveGerada={vi.fn()} /><button>fora</button></>);
  return { gravar, irPara };
};

describe('Agendamento', () => {
  it('sem visita: cadeado e "Mudar o objetivo"', async () => {
    const { irPara } = abrir({ reach: 'qualify' });
    expect(screen.getByText('Ela não agenda visita')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o objetivo' }));
    expect(irPara).toHaveBeenCalledWith('objetivo');
  });

  it('duração em botões; antecedência grava ao sair, como subchave', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('radio', { name: '45 min' }));
    expect(gravar).toHaveBeenCalledWith({ visit_duration_minutes: 45 });
    const minimo = screen.getByLabelText('Antecedência mínima (horas)');
    await userEvent.clear(minimo);
    await userEvent.type(minimo, '2');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ visit_config: expect.objectContaining({ min_advance_hours: 2 }) }, ['visit_config.min_advance_hours']);
  });

  it('avaliação no Google: só depois de visita realizada, com o link', async () => {
    const { gravar } = abrir({ ask_google_review: true });
    expect(screen.getByText(/Visita cancelada ou em que o lead faltou não pede/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Link de avaliação do Google'), 'https://g.page/r/abc');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ google_review_link: 'https://g.page/r/abc' });
  });

  it('"Quando propor" grava a subchave do roteiro e mostra o texto de fábrica', async () => {
    const { gravar } = abrir();
    expect(await screen.findByPlaceholderText('já disse a faixa de valor')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Quando propor a visita'), 'perguntou do plantão');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith(
      { playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'], lead_pronto: 'perguntou do plantão' } } },
      ['playbook.vars.lead_pronto'],
    );
  });
});
