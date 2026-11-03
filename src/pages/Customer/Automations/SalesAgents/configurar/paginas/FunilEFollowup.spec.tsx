import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const listarFluxos = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({ flowAutomationsService: { list: listarFluxos } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'f1', name: 'Vendas' }] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));
import FunilEFollowup from './FunilEFollowup';

beforeEach(() => { listarFluxos.mockReset(); listarFluxos.mockResolvedValue([]); });

const abrir = (extra = {}) => {
  const gravar = gravarDeTeste('funil');
  render(<FunilEFollowup agent={agenteDeTeste(extra)} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
  return gravar;
};

describe('Funil e follow-up', () => {
  it('funil e linha do tempo na mesma página, com a chave "Esta IA só faz follow-up"', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Mover o card' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Linha do tempo' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Esta IA só faz follow-up' })).not.toBeChecked();
  });

  it('"Esta IA só faz follow-up" grava followup_only', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('switch', { name: 'Esta IA só faz follow-up' }));
    expect(gravar).toHaveBeenCalledWith({ followup_only: true });
  });

  it('ligada, desligar grava followup_only false', async () => {
    const gravar = abrir({ followup_only: true });
    expect(screen.getByRole('switch', { name: 'Esta IA só faz follow-up' })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Esta IA só faz follow-up' }));
    expect(gravar).toHaveBeenCalledWith({ followup_only: false });
  });
});
