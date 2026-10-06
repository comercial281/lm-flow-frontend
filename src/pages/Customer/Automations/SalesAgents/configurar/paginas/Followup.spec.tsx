import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: vi.fn().mockResolvedValue([
    { id: 'fu-padrao', name: 'Follow-up padrão', is_enabled: true, archived_at: null, template_key: 'follow_up_padrao', created_at: '2026-10-06T00:00:00Z' },
  ]) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'f1', name: 'Vendas' }] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));
import Followup from './Followup';

const abrir = (agent: SalesAgent = agenteDeTeste()) => {
  const gravar = gravarDeTeste('followup');
  render(<><Followup agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} aoChaveGerada={vi.fn()} /><button>fora</button></>);
  return gravar;
};

describe('Follow-up (linha do tempo)', () => {
  it('linha do tempo: Lead parou → Retomada (1ª e 2ª) → Entrega depois de N dias (um campo só)', async () => {
    const gravar = abrir(agenteDeTeste({ reengagement_enabled: true }));
    expect(screen.getByText('Lead parou de responder')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Retomada' })).toBeChecked();
    expect(screen.queryByLabelText(/Máximo de tentativas/)).toBeNull();
    const dias = screen.getByLabelText('Dias de silêncio até entregar');
    await userEvent.clear(dias);
    await userEvent.type(dias, '3');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ followup_min_days: 3, followup_max_days: 3 });
  });

  it('"Depois dela" tem só as 2 opções do Follow-up padrão; Entregar já traz o Follow-up padrão', async () => {
    const gravar = abrir(agenteDeTeste({ followup_action: 'pipeline', followup_flow_id: null }));
    expect(screen.queryByText(/A IA escreve/)).toBeNull();
    await screen.findByRole('radio', { name: 'Entregar pro follow-up' });
    await new Promise((r) => setTimeout(r, 0)); // lista de follow-ups
    await userEvent.click(screen.getByRole('radio', { name: 'Entregar pro follow-up' }));
    expect(gravar).toHaveBeenCalledWith({ followup_action: 'sequence', followup_flow_id: 'fu-padrao' });
  });

  it('IA antiga em "A IA escreve": nenhuma opção marcada, aviso, e ligar o follow-up é recusado até escolher', async () => {
    const gravar = abrir(agenteDeTeste({ followup_enabled: false, followup_action: 'ai' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Ir atrás de quem parou de responder' }));
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Ir atrás de quem parou de responder' })).not.toBeChecked();
    expect(screen.getByText('Escolha como o follow-up continua: a IA não escreve mais o follow-up.')).toBeInTheDocument();
    screen.getAllByRole('radio', { name: /Entregar pro follow-up|Mover o card/ }).forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));
  });

  it('Quais leads: frase fixa da regra + Todos esses / Só os destes funis', async () => {
    const gravar = abrir();
    expect(screen.getByText(/Só quem ela atendeu e que ainda não foi pra um corretor/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Só os destes funis' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Vendas' }));
    expect(gravar).toHaveBeenCalledWith({ followup_pipeline_ids: ['f1'] });
  });
});
